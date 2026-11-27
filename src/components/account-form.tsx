"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/login/login.module.css";
import { AuthFrame } from "@/components/auth-frame";
import { SocialLoginButtons } from "@/components/social-login-buttons";
import { apiFetch } from "@/lib/api";

type Mode = "register" | "forgot" | "reset";

const copy = {
  register: {
    tag: "CONTA ORANGE",
    title: "Crie sua conta",
    description: "Acompanhe seus atendimentos e fale com a equipe Orange. Depois, confirme seu e-mail para entrar.",
  },
  forgot: {
    tag: "RECUPERAÇÃO DE ACESSO",
    title: "Esqueceu a senha?",
    description: "Enviaremos um link seguro para o e-mail da sua conta.",
  },
  reset: {
    tag: "NOVA SENHA",
    title: "Redefina sua senha",
    description: "Escolha uma nova senha para voltar à sua conta.",
  },
} satisfies Record<Mode, { tag: string; title: string; description: string }>;

type ApiMessage = { message?: string | string[] };

function getApiMessage(payload: ApiMessage | null, fallback: string): string {
  return Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? fallback;
}

export function AccountForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [resendError, setResendError] = useState(false);
  const passwordLength = Array.from(password).length;
  const passwordLengthValid = passwordLength >= 12 && passwordLength <= 128;

  useEffect(() => {
    if (mode !== "forgot") return;
    let active = true;
    apiFetch("/api/auth/oauth/providers", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { passwordReset?: boolean } : null)
      .then((status) => { if (active && status) setPasswordResetEnabled(status.passwordReset === true); })
      .catch(() => {});
    return () => { active = false; };
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    const form = new FormData(event.currentTarget);

    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const request = mode === "register"
      ? {
          url: "/api/auth/register",
          body: {
            name: String(form.get("name") ?? "").trim(),
            email: email.trim(),
            password,
          },
        }
      : mode === "forgot"
        ? { url: "/api/auth/password/forgot", body: { email: email.trim() } }
        : { url: "/api/auth/password/reset", body: { token, password } };

    setSubmitting(true);
    try {
      const response = await apiFetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const payload = await response.json().catch(() => null) as ApiMessage | null;
      if (!response.ok) {
        setError(getApiMessage(payload, "Não foi possível concluir. Tente novamente."));
        setCanResendVerification(mode === "register" && response.status === 409);
        return;
      }

      setComplete(true);
      if (mode === "forgot") {
        setNotice("Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.");
      }
      if (mode === "register") {
        setNotice("Conta criada! Enviamos um link de confirmação para seu e-mail. Confirme o endereço antes de entrar.");
        setCanResendVerification(true);
        window.dispatchEvent(new CustomEvent("orange:cadastro", { detail: { method: "email" } }));
      }
      if (mode === "reset") {
        setNotice("Senha atualizada. Entre com sua nova senha.");
        window.setTimeout(() => router.replace("/login"), 1800);
      }
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    setResendNotice("");
    setResendError(false);
    if (!email.trim()) {
      setResendNotice("Informe o e-mail usado no cadastro.");
      setResendError(true);
      return;
    }

    setResending(true);
    try {
      const response = await apiFetch("/api/auth/email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => null) as ApiMessage | null;
      if (!response.ok) {
        setResendNotice(getApiMessage(payload, "Não foi possível solicitar outro e-mail agora."));
        setResendError(true);
        return;
      }
      setResendNotice(typeof payload?.message === "string"
        ? payload.message
        : "Se a conta ainda precisar de confirmação, enviaremos um novo link.");
    } catch {
      setResendNotice("Não foi possível conectar ao servidor. Tente novamente em instantes.");
      setResendError(true);
    } finally {
      setResending(false);
    }
  }

  const content = copy[mode];
  const resetTokenMissing = mode === "reset" && !token;
  const showPasswordFields = mode === "register" || mode === "reset";
  const resendButton = (
    <button
      type="button"
      className={styles.secondaryButton}
      onClick={resendVerification}
      disabled={resending}
    >
      {resending ? "Enviando…" : "Reenviar e-mail de confirmação"}
    </button>
  );
  const resendMessage = resendNotice && (
    <p className={resendError ? styles.error : styles.message} role={resendError ? "alert" : "status"}>
      {resendNotice}
    </p>
  );

  return (
    <AuthFrame mode={mode === "register" ? "register" : "login"} showModeSwitch={mode !== "reset"}>
      <div className={styles.header}>
        <span className={styles.tag}>{content.tag}</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      {mode === "register" && !complete && <SocialLoginButtons mode="register" />}
      {resetTokenMissing ? (
        <p className={styles.error} role="alert">Este link está incompleto. Peça uma nova recuperação de senha.</p>
      ) : complete ? (
        mode === "register" ? (
          <div className={styles.verificationActions}>
            <p className={styles.message} role="status">{notice}</p>
            {canResendVerification && resendButton}
            {resendMessage}
          </div>
        ) : <p className={styles.message} role="status">{notice}</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === "register" && <>
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Seu nome"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
              autoFocus
            />
          </>}
          {(mode === "register" || mode === "forgot") && <>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="voce@exemplo.com"
              autoComplete={mode === "register" ? "username" : "email"}
              maxLength={254}
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setCanResendVerification(false);
                setResendNotice("");
                setError("");
              }}
            />
          </>}
          {showPasswordFields && <>
            <label htmlFor="password">{mode === "reset" ? "Nova senha" : "Senha"}</label>
            <div className={styles.passwordField}>
              <input
                id="password"
                name="password"
                type={passwordsVisible ? "text" : "password"}
                placeholder="Mínimo de 12 caracteres"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                autoFocus={mode === "reset"}
                aria-describedby="password-hint"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                aria-label={passwordsVisible ? "Ocultar senhas" : "Mostrar senhas"}
                aria-pressed={passwordsVisible}
                aria-controls={mode === "register" ? "password confirmPassword" : "password"}
                onClick={() => setPasswordsVisible(!passwordsVisible)}
              >
                {passwordsVisible ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p
              id="password-hint"
              className={passwordLengthValid ? styles.passwordHintReady : styles.passwordHint}
              aria-live="polite"
            >
              {passwordLengthValid
                ? "Tamanho adequado. Uma frase-senha exclusiva ajuda a proteger sua conta."
                : `${passwordLength}/12 caracteres mínimos (limite de 128).`}
            </p>
            <label htmlFor="confirmPassword">{mode === "reset" ? "Confirme a nova senha" : "Confirme a senha"}</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={passwordsVisible ? "text" : "password"}
              placeholder="Digite a senha novamente"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
            />
            {confirmPassword !== "" && password !== confirmPassword && (
              <p className={styles.passwordHint} aria-live="polite">As senhas ainda não coincidem.</p>
            )}
          </>}
          <button
            type="submit"
            className={styles.loginButton}
            disabled={submitting || (mode === "forgot" && passwordResetEnabled === false)}
          >
            {submitting
              ? "Aguarde…"
              : mode === "register"
                ? "Criar conta"
                : mode === "forgot"
                  ? "Enviar link de recuperação"
                  : "Salvar nova senha"}
          </button>
          {mode === "forgot" && passwordResetEnabled === false && (
            <p className={styles.message} role="status">
              A recuperação por e-mail está temporariamente indisponível. Entre em contato com a equipe Orange.
            </p>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {mode === "register" && canResendVerification && (
            <div className={styles.verificationActions}>
              {resendButton}
              {resendMessage}
            </div>
          )}
        </form>
      )}
      <div className={styles.footer}>
        {mode === "register"
          ? <p>Já tem uma conta? <a className={styles.inlineLink} href="/login">Entrar</a></p>
          : <p><a className={styles.inlineLink} href="/login">Voltar para o login</a></p>}
      </div>
    </AuthFrame>
  );
}
