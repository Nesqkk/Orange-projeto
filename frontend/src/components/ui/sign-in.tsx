"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/login/login.module.css";
import { AuthFrame } from "@/components/auth-frame";
import { SocialLoginButtons } from "@/components/social-login-buttons";

type Identity = { role: "ADMIN" | "CUSTOMER" };

function destination(user: Identity) {
  return user.role === "ADMIN" ? "/admin" : "/central-de-operacoes";
}

export function SignInPage({ initialMfaRequired = false, oauthError = "" }: { initialMfaRequired?: boolean; oauthError?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(initialMfaRequired);

  useEffect(() => {
    if (oauthError === "cancelled") setNotice("O acesso com o provedor foi cancelado.");
    if (oauthError === "error") setNotice("Não foi possível entrar com essa conta. Tente novamente ou use e-mail e senha.");
  }, [oauthError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
        setNotice(message ?? "Não foi possível entrar. Confira os dados e tente novamente.");
        return;
      }

      const payload = await response.json() as (Identity & { mfaRequired?: false }) | { mfaRequired: true };
      if ("mfaRequired" in payload && payload.mfaRequired) {
        setMfaRequired(true);
        return;
      }
      router.replace(destination(payload));
      router.refresh();
    } catch {
      setNotice("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    try {
      const response = await fetch("/api/auth/mfa/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
        setNotice(message ?? "Código inválido. Tente novamente.");
        return;
      }
      const user = await response.json() as Identity;
      router.replace(destination(user));
      router.refresh();
    } catch {
      setNotice("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame mode="login" showModeSwitch={!mfaRequired}>
        <div className={styles.header}>
          <span className={styles.tag}>{mfaRequired ? "AUTENTICAÇÃO EM DUAS ETAPAS" : "ÁREA DO CLIENTE E DA EQUIPE"}</span>
          <h1>{mfaRequired ? "Confirme seu acesso" : "Bem-vindo de volta"}</h1>
          <p>{mfaRequired ? "Digite o código do app autenticador ou um código de recuperação." : "Entre para acompanhar sua conta e seus atendimentos."}</p>
        </div>
        {mfaRequired ? (
          <form onSubmit={verifyMfa} className={styles.form}>
            <label htmlFor="code">Código de autenticação</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000 ou código de recuperação" minLength={6} maxLength={32} required autoFocus />
            <button type="submit" className={styles.loginButton} disabled={submitting}>{submitting ? "Verificando…" : "Confirmar e entrar"}</button>
            {notice && <p className={styles.error} role="alert">{notice}</p>}
            <button type="button" className={styles.backLink} onClick={() => { setMfaRequired(false); setNotice(""); }}>Voltar ao login</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" placeholder="voce@exemplo.com" autoComplete="username" maxLength={254} required />
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" placeholder="Sua senha de acesso" autoComplete="current-password" minLength={12} maxLength={128} required />
            <a className={styles.forgotLink} href="/esqueci-senha">Esqueci minha senha</a>
            <button type="submit" className={styles.loginButton} disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
            {notice && <p className={styles.error} role="alert">{notice}</p>}
          </form>
        )}
        {!mfaRequired && <SocialLoginButtons />}
        {!mfaRequired && <div className={styles.footer}>
          <p>Ainda não tem conta? <a className={styles.inlineLink} href="/cadastro">Criar conta</a></p>
        </div>}
    </AuthFrame>
  );
}
