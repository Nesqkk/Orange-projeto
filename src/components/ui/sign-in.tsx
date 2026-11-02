"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, MoveRight } from "lucide-react";

interface SignInPageProps {
  onSignIn?: (event: FormEvent<HTMLFormElement>) => void;
}

export function SignInPage({ onSignIn }: SignInPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSignIn?.(event);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <a className="brand-lockup" href="/" aria-label="Beba Orange, início">
          <span className="brand-mark">B</span>
          <span>BEBA <b>ORANGE</b></span>
        </a>
        <div className="login-content">
          <p className="eyebrow">PAINEL ADMINISTRATIVO</p>
          <h1>Bom ter você<br />de volta.</h1>
          <p className="muted-copy">Entre para acompanhar sua operação.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" placeholder="voce@empresa.com" autoComplete="username" required />
            <div className="label-line">
              <label htmlFor="password">Senha</label>
              <button className="login-help" type="button" onClick={() => setNotice("A recuperação de senha estará disponível após conectar a autenticação.")}>Esqueceu a senha?</button>
            </div>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Sua senha" autoComplete="current-password" required />
              <button type="button" className="icon-button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button className="primary-button login-submit" type="submit">Entrar no painel <MoveRight size={17} /></button>
          </form>
          {notice && <p className="demo-note" role="status">{notice}</p>}
          <p className="demo-note">Prévia local: autenticação ainda não conectada.</p>
        </div>
        <p className="login-footer">BEBA ORANGE <span>·</span> OPERAÇÕES</p>
      </section>
      <aside className="login-art" aria-label="Identidade visual Beba Orange">
        <div className="art-index">01 / CENTRAL DE OPERAÇÕES</div>
        <div className="art-copy">
          <span>UM OLHAR.</span>
          <span>TODA A</span>
          <strong>OPERAÇÃO.</strong>
        </div>
        <div className="art-bottom"><span>GESTÃO EM TEMPO REAL</span><span>BO</span></div>
      </aside>
    </main>
  );
}