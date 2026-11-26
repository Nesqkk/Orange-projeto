"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/login/login.module.css";
import { AuthFrame } from "@/components/auth-frame";
import { SocialLoginButtons } from "@/components/social-login-buttons";

type Mode = "register" | "forgot" | "reset";

const copy = {
  register: { tag: "CONTA ORANGE", title: "Crie sua conta", description: "Acompanhe seus atendimentos e fale com a equipe Orange." },
  forgot: { tag: "RECUPERAÇÃO DE ACESSO", title: "Esqueceu a senha?", description: "Enviaremos um link seguro para o e-mail da sua conta." },
  reset: { tag: "NOVA SENHA", title: "Redefina sua senha", description: "Escolha uma nova senha para voltar à sua conta." },
} satisfies Record<Mode, { tag: string; title: string; description: string }>;

export function AccountForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (mode !== "forgot") return;
    let active = true;
    fetch("/api/auth/oauth/providers", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { passwordReset?: boolean } : null)
      .then((status) => { if (active && status) setPasswordResetEnabled(status.passwordReset === true); })
      .catch(() => {});
    return () => { active = false; };
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if ((mode === "register" || mode === "reset") && password !== String(form.get("confirmPassword") ?? "")) {
      setError("As senhas não coincidem.");
      setSubmitting(false);
      return;
    }

    const request = mode === "register"
      ? { url: "/api/auth/register", body: { name: form.get("name"), email: form.get("email"), password } }
      : mode === "forgot"
        ? { url: "/api/auth/password/forgot", body: { email: form.get("email") } }
        : { url: "/api/auth/password/reset", body: { token, password } };

    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
      if (!response.ok) {
        setError(Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      setComplete(true);
      if (mode === "forgot") setNotice("Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.");
      if (mode === "register") setNotice("Conta criada. Agora você já pode entrar e abrir uma solicitação.");
      if (mode === "reset") setNotice("Senha atualizada. Entre com sua nova senha.");
      if (mode === "reset") window.setTimeout(() => router.replace("/login"), 1800);
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  const content = copy[mode];
  const resetTokenMissing = mode === "reset" && !token;

  return (
    <AuthFrame mode={mode === "register" ? "register" : "login"} showModeSwitch={mode !== "reset"}>
        <div className={styles.header}><span className={styles.tag}>{content.tag}</span><h1>{content.title}</h1><p>{content.description}</p></div>
        {resetTokenMissing ? <p className={styles.error} role="alert">Este link está incompleto. Peça uma nova recuperação de senha.</p> : !complete ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            {mode === "register" && <><label htmlFor="name">Nome</label><input id="name" name="name" type="text" placeholder="Seu nome" autoComplete="name" minLength={2} maxLength={120} required /></>}
            {(mode === "register" || mode === "forgot") && <><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" maxLength={254} required /></>}
            {(mode === "register" || mode === "reset") && <><label htmlFor="password">{mode === "reset" ? "Nova senha" : "Senha"}</label><input id="password" name="password" type="password" placeholder="Mínimo de 12 caracteres" autoComplete={mode === "reset" ? "new-password" : "new-password"} minLength={12} maxLength={128} required /><label htmlFor="confirmPassword">Confirme a senha</label><input id="confirmPassword" name="confirmPassword" type="password" placeholder="Digite a senha novamente" autoComplete="new-password" minLength={12} maxLength={128} required /></>}
            <button type="submit" className={styles.loginButton} disabled={submitting || (mode === "forgot" && passwordResetEnabled === false)}>{submitting ? "Aguarde…" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar link de recuperação" : "Salvar nova senha"}</button>
            {mode === "forgot" && passwordResetEnabled === false && <p className={styles.message} role="status">A recuperação por e-mail está temporariamente indisponível. Entre em contato com a equipe Orange.</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </form>
        ) : <p className={styles.message} role="status">{notice}</p>}
        {mode === "register" && !complete && <SocialLoginButtons mode="register" />}
        <div className={styles.footer}>
          {mode === "register" ? <p>Já tem uma conta? <a className={styles.inlineLink} href="/login">Entrar</a></p> : <p><a className={styles.inlineLink} href="/login">Voltar para o login</a></p>}
        </div>
    </AuthFrame>
  );
}
