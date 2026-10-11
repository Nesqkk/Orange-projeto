"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import StaggerTestimonials from "@/components/orange/StaggerTestimonials";
import NfcIdeaCarousel from "@/components/orange/NfcIdeaCarousel";
import StoryCardsCarousel from "@/components/orange/StoryCardsCarousel";

// Os valores são fictícios e servem somente como exemplo visual.
const plans = [
  { name: "Solo", amount: "R$ 9,90", detail: "por garrafa", description: "Pra matar a sede de um jeito melhor.", perks: ["Suco 100% natural", "Laranja de verdade", "Embalagem retornável"], featured: false },
  { name: "Orange Club", amount: "R$ 34,90", detail: "/ mês", description: "Sua dose de frescor, sem complicação.", perks: ["4 garrafas por mês", "Cashback na devolução", "Acesso a edições especiais"], featured: true },
  { name: "Orange+", amount: "R$ 44,90", detail: "/ mês", description: "Mais cuidado na sua rotina.", perks: ["4 garrafas enriquecidas com colágeno", "Cashback na devolução", "Entrega recorrente"], featured: false },
];

export default function Home() {
  const [light, setLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollStage, setScrollStage] = useState(0);
  const themeClass = `${light ? "site light" : "site"} scroll-stage-${scrollStage}`;

  // Ajusta suavemente a atmosfera do fundo conforme a pessoa percorre a página.
  useEffect(() => {
    const updateStage = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      setScrollStage(Math.min(4, Math.floor(progress * 5)));
    };
    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    window.addEventListener("resize", updateStage);
    return () => {
      window.removeEventListener("scroll", updateStage);
      window.removeEventListener("resize", updateStage);
    };
  }, []);

  return (
    <main className={themeClass}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      {/* Header reduzido: somente o símbolo da marca, navegação essencial e tema. */}
      <header className="navbar">
        <a className="brand brand-symbol-only brand-reveal" href="#inicio" aria-label="Orange — início">
          <Image src="/orange-logo.png" alt="Símbolo da Orange" width={44} height={44} priority />
          <span className="brand-reveal-text" aria-hidden="true">
            {["o", "r", "a", "n", "g", "e"].map((letter, index) => (
              <span className="brand-letter" key={`${letter}-${index}`}>{letter}</span>
            ))}
            <span className="brand-letter brand-dot">.</span>
          </span>
        </a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Navegação principal">
          <a href="#conceito" onClick={() => setMenuOpen(false)}>A experiência</a>
          <a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a>
          <a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a>
          <a href="#avaliacoes" onClick={() => setMenuOpen(false)}>Avaliações</a>
          <a className="nav-cta" href="#planos" onClick={() => setMenuOpen(false)}><span>Ver planos</span><ArrowRight size={15} /></a>
        </nav>
        <div className="nav-actions">
          <button className="theme-toggle" onClick={() => setLight(!light)} aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}>
            {light ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Hero enxuto: título, descrição curta e garrafa ilustrativa. */}
      <section className="hero section-shell minimal-hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> NATURALMENTE FORA DO ÓBVIO</div>
          <h1>O lado mais <span>vivo</span><br />da sua rotina.</h1>
          <p className="hero-description">Laranja de verdade. Sabor que desperta. Uma experiência feita pra quem quer sentir a diferença em cada gole.</p>
          <div className="hero-actions">
            <a className="button button-orange" href="#planos"><span>Descubra Orange</span><ArrowRight size={17} /></a>
          </div>
        </div>

        <div className="hero-visual" aria-label="Garrafa Orange ilustrativa">
          <div className="visual-orbit orbit-a" />
          <div className="visual-orbit orbit-b" />
          <div className="orange-glow" />
          <div className="bottle-stage">
            <div className="bottle-cap" />
            <div className="bottle-neck" />
            <div className="bottle">
              <div className="bottle-shine" />
              <div className="bottle-liquid" />
              <div className="bottle-label">
                <span className="label-small">FRESHLY PRESSED</span>
                <strong>orange<span>.</span></strong>
                <i>PURE ORANGE JUICE</i>
                <div className="label-fruit">◉</div>
                <small>300 ml · sem mistério</small>
              </div>
              <div className="bottle-base" />
            </div>
          </div>
        </div>
        <a href="#planos" className="scroll-cue"><span>SCROLL PRA SENTIR</span><span className="scroll-arrow">↓</span></a>
      </section>


      {/* Seção de conceito: explica a proposta da marca em três ideias simples. */}
      <section className="story section-shell" id="conceito">
        <div className="story-grid">
          <h2>Não é só suco.<br /><span>É sentir o agora.</span></h2>
          <div className="story-text">
            <p>A Orange nasceu de uma ideia simples: deixar o natural ser extraordinário. Sem complicar o que já é bom — só fruta, frescor e um jeito mais inteligente de consumir.</p>
            <a className="underlined-link" href="#beneficios">Conheça nosso jeito <ArrowRight size={16} /></a>
          </div>
        </div>
        <StoryCardsCarousel />
      </section>

      {/* Benefícios em lista para manter a leitura objetiva. */}
      <section className="benefits section-shell" id="beneficios">
        <div className="benefit-heading nfc-feature-heading">
          <div className="nfc-copy">
            <h2>A garrafa Orange<br /><span>vai se conectar por NFC.</span></h2>
            <p>Cada garrafa terá um chip NFC. Aproxime um celular compatível para abrir a experiência digital da Orange vinculada ao produto.</p>
            <div className="nfc-how-it-works">
              <span className="nfc-how-icon" aria-hidden="true">↗</span>
              <span><strong>É só aproximar.</strong><br />Sem procurar um código ou endereço.</span>
            </div>
            <small className="nfc-footnote">A experiência e as funcionalidades serão apresentadas no lançamento.</small>
          </div>
          <NfcIdeaCarousel />
        </div>
        <div className="benefit-list">
          <article><span className="benefit-icon">✳</span><div><h3>Natural de verdade</h3><p>O sabor da laranja como ele deve ser: vivo, cítrico e direto ao ponto.</p></div><span className="benefit-arrow"><ArrowRight /></span></article>
          <article><span className="benefit-icon">↻</span><div><h3>Devolveu, ganhou</h3><p>Devolva sua garrafa e receba cashback conforme as regras do programa.</p></div><span className="benefit-arrow"><ArrowRight /></span></article>
          <article><span className="benefit-icon">⌁</span><div><h3>Seu ritmo, suas regras</h3><p>Compre quando quiser ou escolha uma assinatura recorrente.</p></div><span className="benefit-arrow"><ArrowRight /></span></article>
          <article><span className="benefit-icon">◉</span><div><h3>Conectada com você</h3><p>A tecnologia NFC aproxima a garrafa da sua experiência digital.</p></div><span className="benefit-arrow"><ArrowRight /></span></article>
        </div>
      </section>

      {/* Planos com preços de demonstração e benefícios essenciais. */}
      <section className="plan-section section-shell" id="planos">
        <div className="plan-heading">
          <span className="fictional-prices">PREÇOS FICTÍCIOS · ESTUDO DE LAYOUT</span>
          <h2>Seu próximo gole<br /><span>começa aqui.</span></h2>
          <p>Sem complicação. Escolha o formato que combina com você.</p>
        </div>
        <div className="plans-grid">
          {plans.map((plan, index) => (
            <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              {plan.featured && <div className="popular-tag">O FAVORITO <Sparkles size={13} /></div>}
              <div className="plan-topline"><span>{plan.name}</span><span>0{index + 1}</span></div>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">{plan.amount}<small>{plan.detail}</small></div>
              <div className="plan-divider" />
              <ul>{plan.perks.map((perk) => <li key={perk}><Check size={15} />{perk}</li>)}</ul>
              <a className={plan.featured ? "button button-orange plan-button" : "button button-outline plan-button"} href={`mailto:oi@orange.com.br?subject=${encodeURIComponent(`Quero conhecer o plano ${plan.name}`)}`}>
                <span>Tenho interesse</span><ArrowRight size={16} />
              </a>
            </article>
          ))}
        </div>
        <p className="plan-note">* Preços fictícios, usados apenas como exemplo visual. Não representam uma oferta comercial real.</p>
      </section>

      {/* Avaliações em cartões sobrepostos com navegação por setas e indicadores. */}
      <section className="reviews-section section-shell" id="avaliacoes">
        <div className="reviews-top">
          <div>
            <h2>Uma experiência Orange.<br /><span>Em demonstração.</span></h2>
          </div>
        </div>
        <StaggerTestimonials />
      </section>


      {/* Perguntas frequentes em formato expansível. */}
      <section className="faq-section section-shell">
        <div>
          <div className="section-kicker">SEM DÚVIDAS</div>
          <h2>Quer saber<br /><span>mais alguma coisa?</span></h2>
        </div>
        <div className="faq-list">
          {[
            { q: "O suco é 100% natural?", a: "A proposta da Orange é oferecer suco de laranja 100% natural. As informações finais de ingredientes e conservação serão exibidas no rótulo." },
            { q: "Como funciona a devolução da garrafa?", a: "A ideia é permitir a devolução em pontos participantes e oferecer cashback conforme as regras do programa, que serão publicadas no lançamento." },
            { q: "Qual é a diferença do Orange+?", a: "É uma versão opcional enriquecida com colágeno. A composição e as informações nutricionais estarão disponíveis na embalagem." },
          ].map((item, index) => (
            <article className="faq-item" key={item.q}>
              <details>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            </article>
          ))}
        </div>
      </section>

      {/* Chamada final curta, mantendo a paleta e o estilo da marca. */}
      <section className="closing-cta">
        <div className="closing-glow" aria-hidden="true" />
        <div className="section-kicker">O NATURAL PODE IR MAIS LONGE</div>
        <h2>Deixa o dia<br />mais <span>Orange.</span></h2>
        <a className="button button-dark" href="#planos">Encontrar meu Orange <ArrowRight size={17} /></a>
        <div className="closing-fruit" aria-hidden="true">✳</div>
      </section>

      {/* Rodapé curto para encerrar a página sem adicionar outra chamada extensa. */}
      <footer className="footer section-shell">
        <div className="footer-main">
          <a className="brand brand-symbol-only" href="#inicio" aria-label="Voltar ao início"><Image src="/orange-logo.png" alt="Símbolo da Orange" width={38} height={38} /></a>
          <p>Fruta de verdade.<br />Uma vida mais viva.</p>
          <a href="mailto:oi@orange.com.br">oi@orange.com.br <ArrowRight size={14} /></a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Orange. Feito com frescor.</span>
          <div><a href="#planos">Planos</a><a href="#avaliacoes">Avaliações</a><a href="#inicio">Voltar ao topo ↑</a></div>
        </div>
      </footer>
    </main>
  );
}
