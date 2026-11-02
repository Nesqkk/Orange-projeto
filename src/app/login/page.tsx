
"use client";

import { FormEvent, useState } from "react";
import styles from "./login.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      "A interface está pronta. A autenticação será conectada ao servidor."
    );
  }

  return (
    <main className={styles.container}>
      <section className={styles.loginCard}>
        <a href="/" className={styles.logo}>
          <span className={styles.logoIcon}>O</span>
          <span>ORANGE</span>
        </a>

        <div className={styles.header}>
          <span className={styles.tag}>ÁREA DO CLIENTE</span>
          <h1>Bem-vindo de volta</h1>
          <p>Entre na sua conta para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" className={styles.loginButton}>
            Entrar na minha conta
          </button>

          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
        </form>

        <div className={styles.footer}>
          <p>
            Ainda não tem uma conta?{" "}
            <span className={styles.comingSoon}>Cadastro em breve</span>
          </p>

          <a href="/" className={styles.backLink}>
            Voltar para a página inicial
          </a>
        </div>
      </section>

      <p className={styles.copyright}>
        Orange © 2026 — Área segura do cliente
      </p>
    </main>
  );
}
