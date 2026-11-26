import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  isConfigured() {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD?.trim();
    const from = process.env.SMTP_FROM?.trim() || user;
    return Boolean(host && user && password && from);
  }

  async sendEmailVerification(email: string, verificationLink: string) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM?.trim() || user;
    if (!host || !user || !password?.trim() || !from) throw new Error('SMTP não configurado para confirmar e-mail.');
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
    try {
      await transport.sendMail({
        from, to: email, subject: 'Confirme seu e-mail da Orange',
        text: `Confirme seu e-mail acessando este link (válido por 24 horas): ${verificationLink}`,
        html: `<p>Confirme seu endereço de e-mail para ativar sua conta Orange.</p><p><a href="${verificationLink}">Confirmar meu e-mail</a></p><p>Este link é válido por 24 horas.</p>`,
      });
    } finally { transport.close(); }
  }

  async sendWelcome(email: string, name?: string | null) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM?.trim() || user;
    if (!host || !user || !password?.trim() || !from) {
      this.logger.warn('SMTP ainda nao foi configurado; e-mail de boas-vindas nao enviado.');
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    const displayName = name?.trim();
    const greeting = displayName ? `Olá, ${displayName}!` : 'Olá!';
    const escapedGreeting = greeting.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]!);
    const siteUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Bem-vindo(a) à Orange!',
        text: `${greeting}\n\nSua conta Orange foi criada com sucesso. Acesse ${siteUrl} para conhecer sua conta e as novidades.\n\nAté mais,\nEquipe Orange`,
        html: `<p>${escapedGreeting}</p><p>Sua conta Orange foi criada com sucesso. <a href="${siteUrl}">Acesse o site</a> para conhecer sua conta e as novidades.</p><p>Até mais,<br>Equipe Orange</p>`,
      });
    } finally {
      transport.close();
    }
  }

  async sendPasswordReset(email: string, resetLink: string) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM?.trim() || user;
    if (!host || !user || !password?.trim() || !from) {
      this.logger.warn('SMTP ainda nao foi configurado; e-mail de redefinicao nao enviado.');
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Redefina sua senha da Orange',
        text: `Recebemos um pedido para redefinir sua senha. Use este link em ate 30 minutos: ${resetLink}\n\nSe voce nao pediu a redefinicao, ignore esta mensagem.`,
        html: `<p>Recebemos um pedido para redefinir sua senha da Orange.</p><p><a href="${resetLink}">Criar uma nova senha</a></p><p>O link expira em 30 minutos. Se voce nao pediu a redefinicao, ignore esta mensagem.</p>`,
      });
    } finally {
      transport.close();
    }
  }
}
