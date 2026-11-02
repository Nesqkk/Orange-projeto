import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { createBackupCodes, createTotpSecret, normalizeBackupCode, verifyTotp } from './totp.js';
import { MailerService } from './mailer.service.js';

export const SESSION_COOKIE_NAME = 'orange_session';
export const MFA_CHALLENGE_COOKIE_NAME = 'orange_mfa_challenge';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export type UserIdentity = { id: string; email: string; role: 'ADMIN' | 'CUSTOMER'; name?: string | null; mfaEnabled: boolean };
export type AdminIdentity = { id: string; email: string; role: 'ADMIN' };

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(cookieHeader: string | undefined, name: string) {
  const prefix = `${name}=`;
  const item = cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

export function readSessionToken(cookieHeader?: string) {
  return readCookie(cookieHeader, SESSION_COOKIE_NAME);
}

export function readMfaChallengeToken(cookieHeader?: string) {
  return readCookie(cookieHeader, MFA_CHALLENGE_COOKIE_NAME);
}

function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  const databaseSecret = process.env.DATABASE_URL ?? process.env.DB_PASSWORD;
  if (!configured && !databaseSecret) throw new InternalServerErrorException('Configure MFA_ENCRYPTION_KEY ou DATABASE_URL no servidor.');
  if (!configured) return createHash('sha256').update('orange-mfa-secret-v1\0').update(databaseSecret!).digest();
  const key = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, 'hex') : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new InternalServerErrorException('MFA_ENCRYPTION_KEY deve conter 32 bytes em hexadecimal ou Base64.');
  return key;
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptSecret(value: string) {
  const [version, ivText, tagText, dataText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !dataText) throw new InternalServerErrorException('Segredo MFA salvo em formato invalido.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new InternalServerErrorException('Nao foi possivel abrir o segredo MFA. Verifique MFA_ENCRYPTION_KEY.');
  }
}

function identity(user: { id: string; email: string; role: string; name?: string | null; mfaEnabled: boolean }): UserIdentity {
  return { id: user.id, email: user.email, role: user.role as UserIdentity['role'], name: user.name, mfaEnabled: user.mfaEnabled };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService, private readonly mailer: MailerService) {}

  async register(email: string, password: string, name?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const user = await this.prisma.user.create({
        data: { email: normalizedEmail, name: name?.trim() || null, passwordHash: await hashPassword(password), role: 'CUSTOMER' },
      });
      return identity(user);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Ja existe uma conta com este e-mail.');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      await hashPassword(password);
      throw new UnauthorizedException('E-mail ou senha invalidos.');
    }
    if (!await verifyPassword(password, user.passwordHash)) throw new UnauthorizedException('E-mail ou senha invalidos.');

    return this.finishLogin(user);
  }

  async loginWithOAuth(provider: 'GOOGLE' | 'APPLE', identityClaims: { subject: string; email?: string; name?: string | null }) {
    const email = identityClaims.email?.trim().toLowerCase() ?? '';
    if (!identityClaims.subject) throw new UnauthorizedException('A conta do provedor não retornou uma identidade válida.');

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const linked = await tx.oAuthAccount.findUnique({
          where: { provider_subject: { provider, subject: identityClaims.subject } },
          include: { user: true },
        });
        if (linked) {
          if (linked.user.role !== 'CUSTOMER') throw new ForbiddenException('Este provedor não está habilitado para contas da equipe.');
          return linked.user;
        }

        if (!email) throw new UnauthorizedException('O provedor não compartilhou um e-mail verificado.');

        let customer = await tx.user.findUnique({ where: { email } });
        if (customer?.role === 'ADMIN') throw new ForbiddenException('Este provedor não está habilitado para contas da equipe.');
        if (!customer) {
          customer = await tx.user.create({
            data: {
              email,
              name: identityClaims.name?.trim().slice(0, 120) || null,
              passwordHash: await hashPassword(randomBytes(48).toString('base64url')),
              role: 'CUSTOMER',
            },
          });
        }
        await tx.oAuthAccount.create({
          data: { provider, subject: identityClaims.subject, providerEmail: email, userId: customer.id },
        });
        return customer;
      });
      return this.finishLogin(user);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const linked = await this.prisma.oAuthAccount.findUnique({
          where: { provider_subject: { provider, subject: identityClaims.subject } },
          include: { user: true },
        });
        if (linked?.user.role === 'CUSTOMER') return this.finishLogin(linked.user);
        throw new ConflictException('Não foi possível vincular esta conta. Tente entrar novamente.');
      }
      throw error;
    }
  }

  private async finishLogin(user: { id: string; email: string; role: string; name?: string | null; mfaEnabled: boolean }) {
    if (!user.mfaEnabled) return this.createSession(user);

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);
    await this.prisma.authChallenge.deleteMany({ where: { userId: user.id } });
    await this.prisma.authChallenge.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
    });
    return { mfaRequired: true as const, challengeToken: token, expiresAt };
  }

  async verifyMfaLogin(challengeToken: string | null, code: string) {
    if (!challengeToken) throw new UnauthorizedException('Desafio MFA ausente ou expirado.');
    const challenge = await this.prisma.authChallenge.findUnique({ where: { tokenHash: hashToken(challengeToken) }, include: { user: true } });
    if (!challenge || challenge.expiresAt <= new Date() || !challenge.user.mfaEnabled || !challenge.user.mfaSecret) {
      if (challenge) await this.prisma.authChallenge.delete({ where: { id: challenge.id } });
      throw new UnauthorizedException('Desafio MFA ausente ou expirado.');
    }
    if (!await this.verifyUserMfaCode(challenge.user, code, true)) throw new UnauthorizedException('Codigo MFA invalido.');
    const consumed = await this.prisma.authChallenge.deleteMany({ where: { id: challenge.id, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new UnauthorizedException('Desafio MFA ja utilizado ou expirado.');
    return this.createSession(challenge.user);
  }

  private async createSession(user: { id: string; email: string; role: string; name?: string | null; mfaEnabled: boolean }) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.authSession.deleteMany({ where: { expiresAt: { lte: now } } });
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await this.prisma.authSession.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt } });
    return { mfaRequired: false as const, token, expiresAt, user: identity(user) };
  }

  async getUserFromCookie(cookieHeader?: string): Promise<UserIdentity> {
    const token = readSessionToken(cookieHeader);
    if (!token) throw new UnauthorizedException('Sessao invalida ou expirada.');
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await this.prisma.authSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Sessao invalida ou expirada.');
    }
    return identity(session.user);
  }

  async getAdminFromCookie(cookieHeader?: string): Promise<AdminIdentity> {
    const user = await this.getUserFromCookie(cookieHeader);
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Acesso restrito a equipe Orange.');
    return { id: user.id, email: user.email, role: 'ADMIN' };
  }

  async logout(cookieHeader?: string) {
    const sessionToken = readSessionToken(cookieHeader);
    const challengeToken = readMfaChallengeToken(cookieHeader);
    if (sessionToken) await this.prisma.authSession.deleteMany({ where: { tokenHash: hashToken(sessionToken) } });
    if (challengeToken) await this.prisma.authChallenge.deleteMany({ where: { tokenHash: hashToken(challengeToken) } });
  }

  async startMfaSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Conta nao encontrada.');
    if (user.mfaEnabled) throw new ConflictException('MFA ja esta ativado nesta conta.');
    const secret = createTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaPendingSecret: encryptSecret(secret) } });
    const label = encodeURIComponent(`Orange:${user.email}`);
    const issuer = encodeURIComponent('Orange');
    return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
  }

  async enableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaPendingSecret) throw new ConflictException('Inicie a configuracao MFA antes de confirmar.');
    const secret = decryptSecret(user.mfaPendingSecret);
    if (!verifyTotp(secret, code)) throw new UnauthorizedException('Codigo MFA invalido.');
    const backupCodes = createBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptSecret(secret),
        mfaPendingSecret: null,
        mfaBackupCodes: JSON.stringify(backupCodes.map((backup) => hashToken(normalizeBackupCode(backup)))),
      },
    });
    return { enabled: true, backupCodes };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new ConflictException('MFA nao esta ativado.');
    if (!await this.verifyUserMfaCode(user, code, true)) throw new UnauthorizedException('Codigo MFA invalido.');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, mfaPendingSecret: null, mfaBackupCodes: null } });
    await this.prisma.authChallenge.deleteMany({ where: { userId } });
    return { enabled: false };
  }

  private async verifyUserMfaCode(user: { id: string; mfaSecret: string | null; mfaBackupCodes: string | null }, code: string, allowBackup: boolean) {
    if (user.mfaSecret && verifyTotp(decryptSecret(user.mfaSecret), code)) return true;
    if (!allowBackup || !user.mfaBackupCodes) return false;
    const hashes = JSON.parse(user.mfaBackupCodes) as string[];
    const candidate = hashToken(normalizeBackupCode(code));
    const index = hashes.indexOf(candidate);
    if (index < 0) return false;
    hashes.splice(index, 1);
    const consumed = await this.prisma.user.updateMany({
      where: { id: user.id, mfaBackupCodes: user.mfaBackupCodes },
      data: { mfaBackupCodes: JSON.stringify(hashes) },
    });
    return consumed.count === 1;
  }

  async requestPasswordReset(email: string) {
    if (!this.mailer.isConfigured()) {
      this.logger.warn('SMTP ainda nao configurado; pedido de redefinicao ignorado.');
      return;
    }
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await this.prisma.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) },
    });
    const baseUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const link = `${baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    try {
      await this.mailer.sendPasswordReset(user.email, link);
    } catch {
      this.logger.error('Falha ao enviar e-mail de redefinicao de senha.');
      await this.prisma.passwordResetToken.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
  }

  async resetPassword(token: string, password: string) {
    const now = new Date();
    const tokenHash = hashToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt <= now) throw new UnauthorizedException('Link invalido ou expirado.');
    const passwordHash = await hashPassword(password);
    const changed = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) return false;
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.authSession.deleteMany({ where: { userId: record.userId } });
      await tx.authChallenge.deleteMany({ where: { userId: record.userId } });
      return true;
    });
    if (!changed) throw new UnauthorizedException('Link invalido ou expirado.');
    return { ok: true };
  }
}
