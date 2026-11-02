import type { ReactNode } from "react";

type SiteInfoPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export default function SiteInfoPage({ eyebrow, title, intro, children }: SiteInfoPageProps) {
  return (
    <main className="site-info-page section-shell">
      <a className="site-info-back" href="/">← Voltar para Orange</a>
      <header className="site-info-header">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <div className="site-info-content">{children}</div>
      <nav className="site-info-links" aria-label="Informações da Orange">
        <a href="/sobre">Sobre</a>
        <a href="/contato">Contato</a>
        <a href="/privacidade">Privacidade</a>
        <a href="/termos">Termos</a>
      </nav>
    </main>
  );
}
