"use client";

import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/auth-frame";
import styles from "@/app/login/login.module.css";
import { apiFetch } from "@/lib/api";

export function EmailVerification({ token }: { token: string }) {
  const [message, setMessage] = useState("Confirmando seu e-mail…");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) { setMessage("Este link está incompleto. Solicite um novo cadastro."); setError(true); return; }
    let active = true;
    apiFetch("/api/auth/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => null) as {
        message?: string | string[];
        welcomeEmailSent?: boolean | null;
      } | null;
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message[0] : payload?.message || "Não foi possível confirmar este link.");
      if (active) {
        setMessage(payload?.welcomeEmailSent === true
          ? "E-mail confirmado! Você já pode entrar. Também enviamos seu e-mail de boas-vindas."
          : payload?.welcomeEmailSent === false
            ? "E-mail confirmado e conta ativa, mas não conseguimos enviar as boas-vindas agora."
            : "E-mail confirmado! Você já pode entrar na sua conta.");
      }
    }).catch((reason: unknown) => {
      if (active) { setMessage(reason instanceof Error ? reason.message : "Não foi possível confirmar este link."); setError(true); }
    });
    return () => { active = false; };
  }, [token]);

  return <AuthFrame mode="login" showModeSwitch={false}>
    <div className={styles.header}><span className={styles.tag}>CONTA ORANGE</span><h1>Confirmação de e-mail</h1><p>{message}</p></div>
    {error ? <p className={styles.error} role="alert">Confira se o link ainda está válido.</p> : message.startsWith("E-mail confirmado") ? <p className={styles.message} role="status">Tudo certo. Acesse sua conta para continuar.</p> : null}
    <div className={styles.footer}><p><a className={styles.inlineLink} href="/login">Ir para o login</a></p></div>
  </AuthFrame>;
}
