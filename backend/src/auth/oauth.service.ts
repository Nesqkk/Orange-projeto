import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

export type OAuthProvider = 'google' | 'apple';
export type VerifiedOAuthIdentity = { subject: string; email?: string; name?: string | null };

type AppleUser = { name?: { firstName?: string; lastName?: string }; email?: string };
type TokenResponse = { id_token?: string; error?: string; error_description?: string };

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function env(name: string) {
  return process.env[name]?.trim() ?? '';
}

function applePrivateKey() {
  return env('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  getProviderStatus() {
    const smtpHost = env('SMTP_HOST');
    const smtpUser = env('SMTP_USER');
    const smtpPassword = env('SMTP_PASSWORD');
    const smtpFrom = env('SMTP_FROM') || smtpUser;
    return {
      google: Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')),
      apple: Boolean(env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && applePrivateKey()),
      passwordReset: Boolean(smtpHost && smtpUser && smtpPassword && smtpFrom),
    };
  }

  private clientId(provider: OAuthProvider) {
    return provider === 'google' ? env('GOOGLE_CLIENT_ID') : env('APPLE_CLIENT_ID');
  }

  private redirectUri(provider: OAuthProvider) {
    const frontendUrl = env('FRONTEND_URL');
    if (!frontendUrl) throw new ServiceUnavailableException('FRONTEND_URL não foi configurada.');
    const parsed = new URL(frontendUrl);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new ServiceUnavailableException('FRONTEND_URL precisa usar HTTPS em produção.');
    }
    return `${parsed.origin}/api/auth/oauth/${provider}/callback`;
  }

  authorizationUrl(provider: OAuthProvider, state: string, nonce: string, codeChallenge?: string) {
    if (!this.getProviderStatus()[provider]) throw new ServiceUnavailableException('Este provedor de login não está configurado.');
    const redirectUri = this.redirectUri(provider);
    const url = provider === 'google'
      ? new URL('https://accounts.google.com/o/oauth2/v2/auth')
      : new URL('https://appleid.apple.com/auth/authorize');
    url.searchParams.set('client_id', this.clientId(provider));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    if (provider === 'google') {
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('prompt', 'select_account');
      if (codeChallenge) {
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
      }
    } else {
      url.searchParams.set('scope', 'email name');
      url.searchParams.set('response_mode', 'form_post');
    }
    return url;
  }

  async verifyCallback(provider: OAuthProvider, code: string, nonce: string, appleUser?: AppleUser, codeVerifier?: string): Promise<VerifiedOAuthIdentity> {
    if (!this.getProviderStatus()[provider]) throw new ServiceUnavailableException('Este provedor de login não está configurado.');
    const redirectUri = this.redirectUri(provider);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId(provider),
      redirect_uri: redirectUri,
    });
    if (provider === 'google') {
      body.set('client_secret', env('GOOGLE_CLIENT_SECRET'));
      if (codeVerifier) body.set('code_verifier', codeVerifier);
    } else {
      body.set('client_secret', await this.createAppleClientSecret());
    }

    const tokenEndpoint = provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://appleid.apple.com/auth/token';
    let response: Response;
    try {
      response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.warn(`Falha de rede no callback ${provider}.`);
      throw new ServiceUnavailableException('Não foi possível validar a conta agora. Tente novamente.');
    }
    const tokenResponse = await response.json().catch(() => ({})) as TokenResponse;
    if (!response.ok || !tokenResponse.id_token) {
      this.logger.warn(`O provedor ${provider} recusou a troca do código OAuth (${response.status}).`);
      throw new UnauthorizedException('Não foi possível validar a conta do provedor.');
    }

    try {
      const jwks = provider === 'google' ? googleJwks : appleJwks;
      const issuer = provider === 'google' ? ['https://accounts.google.com', 'accounts.google.com'] : 'https://appleid.apple.com';
      const { payload } = await jwtVerify(tokenResponse.id_token, jwks, {
        issuer,
        audience: this.clientId(provider),
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
      });
      if (payload.nonce !== nonce || typeof payload.sub !== 'string') throw new Error('Nonce or subject validation failed.');

      const email = typeof payload.email === 'string' ? payload.email : appleUser?.email;
      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
      if (email && !emailVerified) throw new UnauthorizedException('Confirme o e-mail no provedor antes de continuar.');
      if (!email) return { subject: payload.sub };

      const claimsName = typeof payload.name === 'string' ? payload.name : null;
      const appleName = [appleUser?.name?.firstName, appleUser?.name?.lastName].filter(Boolean).join(' ');
      return { subject: payload.sub, email, name: claimsName || appleName || null };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`Token de identidade inválido recebido de ${provider}.`);
      throw new UnauthorizedException('Não foi possível validar a conta do provedor.');
    }
  }

  private async createAppleClientSecret() {
    const key = await importPKCS8(applePrivateKey(), 'ES256');
    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: env('APPLE_KEY_ID') })
      .setIssuer(env('APPLE_TEAM_ID'))
      .setSubject(env('APPLE_CLIENT_ID'))
      .setAudience('https://appleid.apple.com')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
  }
}
