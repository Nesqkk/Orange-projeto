"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Menu, Moon, Sun, X, Sparkles } from "lucide-react";
import StaggerTestimonials from "@/components/orange/StaggerTestimonials";
import LogoAnimada from "@/components/orange/LogoAnimada";

// Garrafa 3D só no navegador (WebGL). Enquanto carrega, o espaço fica vazio e a entrada enche a garrafa.
const GarrafaHero = dynamic(() => import("@/components/orange/GarrafaHero"), { ssr: false });

// Os valores são fictícios e servem somente como exemplo visual.
const plans = [
  { name: "Solo", amount: "R$ 9,90", detail: "por garrafa", description: "Pra matar a sede de um jeito melhor.", perks: ["Suco 100% natural", "Laranja de verdade", "Embalagem retornável"], featured: false },
  { name: "Orange Club", amount: "R$ 34,90", detail: "/ mês", description: "Sua dose de frescor, sem complicação.", perks: ["4 garrafas por mês", "Cashback na devolução", "Acesso a edições especiais"], featured: true },
  { name: "Orange+", amount: "R$ 44,90", detail: "/ mês", description: "Mais cuidado na sua rotina.", perks: ["4 garrafas enriquecidas com colágeno", "Cashback na devolução", "Entrega recorrente"], featured: false },
];

type StoryCard = {
  number: string;
  title: string;
  description: string;
  caption: string;
  style: "card-orange" | "card-dark" | "card-cream";
  artType: "fruit" | "circle" | "spark";
  artText: string;
};

// Classe CSS de cada tipo de arte decorativa do card.
const artClass: Record<StoryCard["artType"], string> = {
  fruit: "fruit-symbol",
  circle: "circle-art",
  spark: "spark-art",
};

const storyCards: StoryCard[] = [
  {
    number: "01",
    title: "Fruta de verdade.",
    description: "Só laranja espremida, sem água e sem açúcar adicionado. Um suco 100% natural, com o sabor fresco da fruta e nada de enrolação.",
    caption: "SIMPLES ASSIM",
    style: "card-orange",
    artType: "fruit",
    artText: "✳",
  },
  {
    number: "02",
    title: "Design com propósito.",
    description: "Uma garrafa pensada pra acompanhar seu ritmo, do café da manhã ao fim do treino. Quando acabar, devolva: ela volta pro ciclo e você ganha cashback.",
    caption: "MENOS DESCARTE",
    style: "card-dark",
    artType: "circle",
    artText: "O",
  },
  {
    number: "03",
    title: "Um cuidado a mais.",
    description: "Quer ir além do suco? O Orange+ vem enriquecido com colágeno, pra quem quer explorar novas possibilidades sem mudar a rotina.",
    caption: "VOCÊ ESCOLHE",
    style: "card-cream",
    artType: "spark",
    artText: "✦",
  },
];

const faqs = [
  { q: "O suco é 100% natural?", a: "A proposta da Orange é oferecer suco de laranja 100% natural. As informações finais de ingredientes e conservação serão exibidas no rótulo." },
  { q: "Como funciona a devolução da garrafa?", a: "A ideia é permitir a devolução em pontos participantes e oferecer cashback conforme as regras do programa, que serão publicadas no lançamento." },
  { q: "Qual é a diferença do Orange+?", a: "É uma versão opcional enriquecida com colágeno. A composição e as informações nutricionais estarão disponíveis na embalagem." },
];

export default function Home() {
  const [light, setLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const siteRef = useRef<HTMLDivElement>(null);
  const currentCard = storyCards[activeCard];
  const themeClass = light ? "site light" : "site";

  // Aquece o laranja do fundo de forma contínua conforme a pessoa percorre a página.
  // A variável CSS é escrita direto no elemento (1x por frame) para não re-renderizar o React a cada scroll.
  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
      siteRef.current?.style.setProperty("--scroll-progress", progress.toFixed(3));
      setStuck(window.scrollY > 24);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateProgress); };
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Lembra o tema escolhido; na primeira visita segue o tema do aparelho.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("orange-tema");
      if (salvo) setLight(salvo === "claro");
      else setLight(matchMedia("(prefers-color-scheme: light)").matches);
    } catch {}
  }, []);

  const alternarTema = () => {
    const proximo = !light;
    setLight(proximo);
    try { localStorage.setItem("orange-tema", proximo ? "claro" : "escuro"); } catch {}
  };

  // Menu do celular fecha com Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className={themeClass} ref={siteRef}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      {/* Botão de tema fora da navbar, fixo no canto direito da tela. */}
      <button type="button" className="theme-toggle" onClick={alternarTema} aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}>
        {light ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      </button>

      {/* Header reduzido: somente o símbolo da marca e a navegação essencial. */}
      <header className={stuck ? "navbar is-stuck" : "navbar"}>
        <a className="brand brand-symbol-only" href="#inicio" aria-label="Orange — início">
          <LogoAnimada altura={44} />
        </a>
        <nav id="menu-principal" className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Navegação principal">
          <a href="#conceito" onClick={() => setMenuOpen(false)}>A experiência</a>
          <a href="#beneficios" onClick={() => setMenuOpen(false)}>Benefícios</a>
          <a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a>
          <a href="#avaliacoes" onClick={() => setMenuOpen(false)}>Avaliações</a>
          <a className="nav-cta" href="#planos" onClick={() => setMenuOpen(false)}>Ver planos <ArrowRight size={15} aria-hidden="true" /></a>
        </nav>
        <div className="toggle">
          <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="menu-principal">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="conteudo">

      {/* Hero enxuto: título, descrição curta e garrafa ilustrativa. */}
      <section className="hero section-shell minimal-hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> NATURALMENTE FORA DO ÓBVIO</div>
          <h1>O lado mais <span>vivo</span><br />da sua rotina.</h1>
          <p className="hero-description">Laranja de verdade. Sabor que desperta. Uma experiência feita pra quem quer sentir a diferença em cada gole.</p>
          <div className="hero-actions">
            <a className="button button-orange" href="#planos">Descubra Orange <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-orbit orbit-a" aria-hidden="true" />
          <div className="visual-orbit orbit-b" aria-hidden="true" />
          <div className="orange-glow" aria-hidden="true" />
          <div className="floating-label label-top"><Sparkles size={14} aria-hidden="true" /> 100% natural</div>
          <GarrafaHero fallback={<GarrafaCss />} />
        </div>
      </section>

      {/* Seção de conceito: explica a proposta da marca em três ideias simples. */}
      <section className="story section-shell" id="conceito">
        <div className="section-kicker">01 / A EXPERIÊNCIA</div>
        <div className="story-grid">
          <h2>Não é só suco.<br /><span>É sentir o agora.</span></h2>
        </div>
        <div className="story-cards is-carousel">
          <article key={currentCard.number} className={`story-card ${currentCard.style}`} aria-live="polite">
            <span className="card-number">{currentCard.number}</span>
            <div className={artClass[currentCard.artType]} aria-hidden="true">
              {currentCard.artText}
            </div>
            <h3>{currentCard.title}</h3>
            <p>{currentCard.description}</p>
            <span className="card-caption">{currentCard.caption}</span>
          </article>
          {/* Dots com as mesmas classes do carrossel de avaliações. */}
          <div className="morphing-dots">
            <button type="button" onClick={() => setActiveCard((activeCard - 1 + storyCards.length) % storyCards.length)} aria-label="Card anterior">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <div className="morphing-dots-list">
              {storyCards.map((card, index) => (
                <button
                  type="button"
                  key={card.number}
                  className={index === activeCard ? "morphing-dot active" : "morphing-dot"}
                  onClick={() => setActiveCard(index)}
                  aria-label={`Ver card ${card.number}`}
                  aria-current={index === activeCard ? "true" : undefined}
                />
              ))}
            </div>
            <button type="button" onClick={() => setActiveCard((activeCard + 1) % storyCards.length)} aria-label="Próximo card">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefícios em grade aberta: sem linhas nem setas, só ícone, título e texto. */}
      <section className="benefits section-shell" id="beneficios">
        <div className="benefit-heading">
          <div className="section-kicker">02 / POR QUE ORANGE?</div>
          <h2>Pequenas escolhas.<br /><span>Boa energia.</span></h2>
          <p>Seu ritual de frescor ficou mais gostoso — e mais consciente.</p>
        </div>
        <div className="benefit-list">
          <article><span className="benefit-icon" aria-hidden="true">✳</span><h3>Natural de verdade</h3><p>O sabor da laranja como ele deve ser: vivo, cítrico e direto ao ponto.</p></article>
          <article><span className="benefit-icon" aria-hidden="true">↻</span><h3>Devolveu, ganhou</h3><p>Devolva sua garrafa e receba cashback conforme as regras do programa.</p></article>
          <article><span className="benefit-icon" aria-hidden="true">⌁</span><h3>Seu ritmo, suas regras</h3><p>Compre quando quiser ou escolha uma assinatura recorrente.</p></article>
          <article><span className="benefit-icon" aria-hidden="true">◉</span><h3>Conectada com você</h3><p>A tecnologia NFC aproxima a garrafa da sua experiência digital.</p></article>
        </div>
      </section>

      {/* Planos com preços de demonstração e benefícios essenciais. */}
      <section className="plan-section section-shell" id="planos">
        <div className="plan-heading">
          <div className="section-kicker">03 / ESCOLHA SEU ORANGE</div>
          <span className="fictional-prices">PREÇOS FICTÍCIOS · ESTUDO DE LAYOUT</span>
          <h2>Seu próximo gole<br /><span>começa aqui.</span></h2>
          <p>Sem complicação. Escolha o formato que combina com você.</p>
        </div>
        <div className="plans-grid">
          {plans.map((plan, index) => (
            <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              {plan.featured && <div className="popular-tag">O FAVORITO <Sparkles size={13} aria-hidden="true" /></div>}
              <div className="plan-topline"><span>{plan.name}</span><span>0{index + 1}</span></div>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">{plan.amount}<small>{plan.detail}</small></div>
              <div className="plan-divider" />
              <ul>{plan.perks.map((perk) => <li key={perk}><Check size={15} aria-hidden="true" />{perk}</li>)}</ul>
              <a className={plan.featured ? "button button-orange plan-button" : "button button-outline plan-button"} href={`mailto:oi@orange.com.br?subject=${encodeURIComponent(`Quero conhecer o plano ${plan.name}`)}`}>
                Tenho interesse <ArrowRight size={16} aria-hidden="true" />
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
            <div className="section-kicker">04 / QUEM JÁ SENTIU</div>
            <h2>Uma experiência Orange.<br /><span>Em demonstração.</span></h2>
          </div>
        </div>
        <StaggerTestimonials />
      </section>

      {/* Perguntas frequentes em formato expansível. */}
      <section className="faq-section section-shell" id="duvidas">
        <div>
          <div className="section-kicker">SEM DÚVIDAS</div>
          <h2>Quer saber<br /><span>mais alguma coisa?</span></h2>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
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
        <a className="button button-dark" href="#planos">Encontrar meu Orange <ArrowRight size={17} aria-hidden="true" /></a>
        <div className="closing-fruit" aria-hidden="true">✳</div>
      </section>
      </main>

      {/* Rodapé curto para encerrar a página sem adicionar outra chamada extensa. */}
      <footer className="footer section-shell">
        <div className="footer-main">
          <a className="brand brand-symbol-only" href="#inicio" aria-label="Voltar ao início"><Image src="/orange-logo.png" alt="Símbolo da Orange" width={38} height={38} /></a>
          <p>Fruta de verdade.<br />Uma vida mais viva.</p>
          <a href="mailto:oi@orange.com.br">oi@orange.com.br <ArrowRight size={14} aria-hidden="true" /></a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Orange. Feito com frescor.</span>
          <div><a href="#planos">Planos</a><a href="#avaliacoes">Avaliações</a><a href="#inicio">Voltar ao topo ↑</a></div>
        </div>
      </footer>
    </div>
  );
}

// Garrafa em CSS: aparece só se o aparelho não conseguir mostrar a 3D.
function GarrafaCss() {
  return (
    <div className="bottle-stage" role="img" aria-label="Garrafa Orange ilustrativa">
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
  );
}
