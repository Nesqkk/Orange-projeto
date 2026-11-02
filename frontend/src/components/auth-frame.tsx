"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import LogoAnimada from "@/components/orange/LogoAnimada";
import styles from "@/app/login/login.module.css";

export function AuthFrame({
  mode,
  showModeSwitch = true,
  children,
}: {
  mode: "login" | "register";
  showModeSwitch?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={styles.container}>
      <div className={styles.blobs} aria-hidden="true"><i /><i /><i /></div>

      <header className={styles.topbar}>
        <a href="/" className={styles.logoOrb} aria-label="Orange, início">
          <LogoAnimada altura={32} />
        </a>
        <a href="/" className={styles.siteLink}>Voltar ao site <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>

      <div className={styles.authLayout}>
        <section className={styles.introPanel} aria-labelledby="auth-pitch">
          <span className={styles.kicker}><Sparkles size={14} aria-hidden="true" /> SUA CONTA ORANGE</span>
          <h2 id="auth-pitch">O seu dia,<br /><span>mais Orange.</span></h2>
          <p className={styles.introCopy}>Acesse seu espaço para acompanhar seus pedidos, assinaturas e conversas com a equipe.</p>

          <div className={styles.previewCard} aria-label="Prévia da sua experiência Orange">
            <div className={styles.previewTop}>
              <span className={styles.previewMark}>O</span>
              <span className={styles.previewTitle}><strong>Seu espaço Orange</strong><small>tudo em um só lugar</small></span>
              <span className={styles.previewStatus}><i /> PRONTO</span>
            </div>
            <div className={styles.previewBody}>
              <span className={styles.previewLabel}>UMA ROTINA MAIS VIVA</span>
              <strong>Seu próximo gole<br />começa por aqui.</strong>
              <div className={styles.previewProgress}><i /></div>
              <div className={styles.previewFooter}><span>FEITO PRA VOCÊ</span><span>01 <ArrowUpRight size={13} aria-hidden="true" /></span></div>
            </div>
            <div className={styles.previewOrb} />
          </div>

          <div className={styles.promise}>
            <span className={styles.promiseIcon}><Check size={16} aria-hidden="true" /></span>
            <span><strong>Simples de acessar.</strong><small>Entre ou crie sua conta em poucos passos.</small></span>
          </div>
        </section>

        <section className={styles.loginCard} aria-label={mode === "login" ? "Acessar sua conta" : "Criar sua conta"}>
          {showModeSwitch && (
            <nav className={styles.modeSwitch} aria-label="Acesso à conta">
              <a href="/login" aria-current={mode === "login" ? "page" : undefined}>Entrar</a>
              <a href="/cadastro" aria-current={mode === "register" ? "page" : undefined}>Criar conta</a>
            </nav>
          )}
          {children}
        </section>
      </div>

      <footer className={styles.pageFooter}>
        <span>© 2026 Beba Orange</span>
        <span><a href="/privacidade">Privacidade</a><a href="/termos">Termos</a></span>
      </footer>
    </main>
  );
}
