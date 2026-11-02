"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Menu, Moon, Sun, X, Sparkles } from "lucide-react";
import StaggerTestimonials from "@/components/orange/StaggerTestimonials";
import LogoAnimada from "@/components/orange/LogoAnimada";
import { useRevelarAoRolar } from "@/lib/use-revelar-ao-rolar";
import { useInclinacao3D } from "@/lib/use-inclinacao-3d";
import { useNumerosQueContam } from "@/lib/use-numeros-que-contam";
import { useBotoesMagneticos } from "@/lib/use-botoes-magneticos";
import { useSucoDerramando } from "@/lib/use-suco-derramando";

// Garrafa 3D só no navegador (WebGL). Enquanto carrega, o espaço fica vazio e a entrada enche a garrafa.
const GarrafaHero = dynamic(() => import("@/components/orange/GarrafaHero"), { ssr: false });

// Os valores são fictícios e servem somente como exemplo visual.
const plans = [
  { name: "Solo", amount: "R$ 9,90", detail: "por garrafa", description: "Pra matar a sede de um jeito melhor.", perks: ["Suco 100% natural", "Laranja de verdade", "Embalagem retornável"], featured: false },
  { name: "Orange Club", amount: "R$ 34,90", detail: "/ mês", description: "Sua dose de frescor, sem complicação.", perks: ["4 garrafas por mês", "Cashback na devolução", "Acesso a edições especiais"], featured: true },
  { name: "Orange+", amount: "R$ 44,90", detail: "/ mês", description: "Mais cuidado na sua rotina.", perks: ["4 garrafas enriquecidas com colágeno", "Cashback na devolução", "Entrega recorrente"], featured: false },
];

// Card que está sendo jogado para fora da tela: para que lado (-1 esquerda, 1 direita) e de onde
// ele partiu (deX), caso a pessoa tenha arrastado antes de soltar.
type CardSaindo = { card: StoryCard; direcao: -1 | 1; deX: number; id: number };

// Arrasto mínimo (px) para o card ser jogado ao soltar; menos que isso, ele volta pro lugar.
const ARRASTO_PARA_JOGAR = 90;
// Um peteleco rápido também joga, mesmo com arrasto curto: basta passar de 30px a mais de 0,5px/ms.
const PETELECO = { arrasto: 30, velocidade: 0.5 };

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

// Links da pílula de navegação; o `id` é a seção para onde cada um leva.
const navItems = [
  { id: "conceito", label: "A experiência" },
  { id: "beneficios", label: "Benefícios" },
  { id: "avaliacoes", label: "Avaliações" },
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
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);
  const siteRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const derrameRef = useRef<HTMLDivElement>(null);
  const planosRef = useRef<HTMLElement>(null);
  // Lista (e não um só) para cliques rápidos seguidos: cada card termina o próprio voo.
  const [cardsSaindo, setCardsSaindo] = useState<CardSaindo[]>([]);
  const vooId = useRef(0);
  const arrasto = useRef<{ inicioX: number; dx: number; ultimoX: number; ultimoT: number; velocidade: number } | null>(null);
  const currentCard = storyCards[activeCard];
  const themeClass = light ? "site light" : "site";

  // Seções abaixo do hero sobem e aparecem conforme entram na tela (elementos com `data-reveal`).
  useRevelarAoRolar(siteRef);
  // Cards de planos inclinam na direção do mouse (elementos com `data-tilt`).
  useInclinacao3D(siteRef);
  // Preços dos planos contam de 0 até o valor quando aparecem (elementos com `data-count`).
  useNumerosQueContam(siteRef);
  // Botões principais são puxados de leve em direção ao cursor (elementos com `data-magnetic`).
  useBotoesMagneticos(siteRef);
  // Na primeira chegada aos planos, o suco cobre a tela, escorre e os planos aparecem por baixo.
  useSucoDerramando(derrameRef, planosRef);

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

  // Descobre em qual seção a pessoa está: a que cruza a faixa no meio da tela.
  useEffect(() => {
    const secoes = ["inicio", "conceito", "beneficios", "planos", "avaliacoes", "duvidas"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) setSecaoAtiva(e.target.id);
        else setSecaoAtiva((atual) => (atual === e.target.id ? null : atual));
      });
    }, { rootMargin: "-45% 0px -54% 0px" });
    secoes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Leva a pílula de destaque da navbar até o link da seção atual (posição e largura via variáveis CSS).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const posicionar = () => {
      const link = nav.querySelector<HTMLElement>(`a[href="#${secaoAtiva}"]:not(.nav-cta)`);
      if (!link) return;
      nav.style.setProperty("--ind-x", `${link.offsetLeft - 14}px`);
      nav.style.setProperty("--ind-w", `${link.offsetWidth + 28}px`);
    };
    posicionar();
    document.fonts?.ready.then(posicionar); // a largura dos links muda quando a fonte termina de carregar
    window.addEventListener("resize", posicionar);
    return () => window.removeEventListener("resize", posicionar);
  }, [secaoAtiva]);

  // Troca o card da seção 01 jogando o atual para fora da tela (para o lado `direcao`).
  const trocarCard = (proximo: number, direcao: -1 | 1, deX = 0) => {
    if (proximo === activeCard) return;
    const id = ++vooId.current;
    setCardsSaindo((lista) => [...lista, { card: currentCard, direcao, deX, id }]);
    setActiveCard(proximo);
  };
  const proximoCard = (deX = 0) => trocarCard((activeCard + 1) % storyCards.length, -1, deX);
  const cardAnterior = (deX = 0) => trocarCard((activeCard - 1 + storyCards.length) % storyCards.length, 1, deX);

  // Arrastar o card para os lados: ele acompanha o dedo/mouse e, se passar do limite (ou levar um
  // peteleco), é jogado. O estilo é escrito direto no elemento durante o arrasto para não re-renderizar
  // o React a cada movimento. Usa `translate`/`rotate` (e não `transform`) para somar com o hover do card.
  const comecarArrasto = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    arrasto.current = { inicioX: e.clientX, dx: 0, ultimoX: e.clientX, ultimoT: e.timeStamp, velocidade: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("is-arrastando");
  };
  const moverArrasto = (e: ReactPointerEvent<HTMLElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const dt = e.timeStamp - a.ultimoT;
    if (dt > 0) a.velocidade = a.velocidade * 0.3 + ((e.clientX - a.ultimoX) / dt) * 0.7; // suaviza os trancos
    a.ultimoX = e.clientX;
    a.ultimoT = e.timeStamp;
    a.dx = e.clientX - a.inicioX;
    e.currentTarget.style.translate = `${a.dx}px 0`;
    e.currentTarget.style.rotate = `${a.dx / 25}deg`;
  };
  const soltarArrasto = (e: ReactPointerEvent<HTMLElement>) => {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    e.currentTarget.classList.remove("is-arrastando");
    e.currentTarget.style.translate = "";
    e.currentTarget.style.rotate = "";
    // Se o dedo parou antes de soltar, não conta como peteleco.
    const velocidade = e.timeStamp - a.ultimoT > 100 ? 0 : a.velocidade;
    const peteleco = Math.abs(a.dx) > PETELECO.arrasto && Math.abs(velocidade) > PETELECO.velocidade && Math.sign(velocidade) === Math.sign(a.dx);
    if (a.dx <= -ARRASTO_PARA_JOGAR || (peteleco && a.dx < 0)) proximoCard(a.dx);
    else if (a.dx >= ARRASTO_PARA_JOGAR || (peteleco && a.dx > 0)) cardAnterior(a.dx);
  };

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
      {/* Suco que cobre a tela ao chegar nos planos (useSucoDerramando). Não captura cliques. */}
      <div className="derrame-tela" ref={derrameRef} aria-hidden="true">
        <div className="derrame-liquido" />
        <span className="derrame-gota" /><span className="derrame-gota" /><span className="derrame-gota" /><span className="derrame-gota" /><span className="derrame-gota" /><span className="derrame-gota" /><span className="derrame-gota" />
      </div>

      {/* Header em 3 peças separadas: logo num círculo, navegação numa pílula e ações à direita. */}
      <header className={stuck ? "navbar is-stuck" : "navbar"}>
        <a className="brand nav-orb" href="#inicio" aria-label="Orange — início">
          <LogoAnimada altura={32} />
        </a>
        <nav
          id="menu-principal"
          ref={navRef}
          className={["nav-links", menuOpen && "open", navItems.some((item) => item.id === secaoAtiva) && "has-indicator"].filter(Boolean).join(" ")}
          aria-label="Navegação principal"
        >
          {/* Pílula que desliza até o link da seção em que a pessoa está. */}
          <span className="nav-indicator" aria-hidden="true" />
          {navItems.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)} aria-current={secaoAtiva === item.id ? "true" : undefined}>{item.label}</a>
          ))}
          <a className="nav-cta" href="#planos" onClick={() => setMenuOpen(false)} aria-current={secaoAtiva === "planos" ? "true" : undefined}>Ver planos <ArrowRight size={15} aria-hidden="true" /></a>
        </nav>
        <div className="toggle">
          <button type="button" className="menu-toggle nav-orb" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="menu-principal">
            {menuOpen ? <X /> : <Menu />}
          </button>
          <button type="button" className="theme-toggle nav-orb" onClick={alternarTema} aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}>
            {light ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
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
            <a className="button button-orange" href="#planos" data-magnetic>Descubra Orange <ArrowRight size={17} aria-hidden="true" /></a>
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
        <div className="section-kicker" data-reveal>01 / A EXPERIÊNCIA</div>
        <div className="story-grid">
          <h2 data-reveal>Não é só suco.<br /><span>É sentir o agora.</span></h2>
        </div>
        <div className="story-cards is-carousel" data-reveal>
          {/* Card atual: dá para arrastar para os lados e jogar. */}
          <StoryCardView
            key={currentCard.number}
            card={currentCard}
            aria-live="polite"
            onPointerDown={comecarArrasto}
            onPointerMove={moverArrasto}
            onPointerUp={soltarArrasto}
            onPointerCancel={soltarArrasto}
          />
          {/* Cards anteriores voando para fora da tela por cima do novo; cada um some quando o voo acaba. */}
          {cardsSaindo.map((saindo) => (
            <StoryCardView
              key={`saindo-${saindo.id}`}
              card={saindo.card}
              className="is-saindo"
              aria-hidden="true"
              style={{ "--dir": saindo.direcao, "--de-x": `${saindo.deX}px`, "--de-rot": `${saindo.deX / 25}deg` } as CSSProperties}
              onAnimationEnd={(e) => {
                if (e.animationName === "card-jogado") setCardsSaindo((lista) => lista.filter((s) => s.id !== saindo.id));
              }}
            />
          ))}
          {/* Dots com as mesmas classes do carrossel de avaliações. */}
          <div className="morphing-dots">
            <button type="button" onClick={() => cardAnterior()} aria-label="Card anterior">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <div className="morphing-dots-list">
              {storyCards.map((card, index) => (
                <button
                  type="button"
                  key={card.number}
                  className={index === activeCard ? "morphing-dot active" : "morphing-dot"}
                  onClick={() => trocarCard(index, index > activeCard ? -1 : 1)}
                  aria-label={`Ver card ${card.number}`}
                  aria-current={index === activeCard ? "true" : undefined}
                />
              ))}
            </div>
            <button type="button" onClick={() => proximoCard()} aria-label="Próximo card">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefícios em grade aberta: sem linhas nem setas, só ícone, título e texto. */}
      <section className="benefits section-shell" id="beneficios">
        <div className="benefit-heading">
          <div className="section-kicker" data-reveal>02 / POR QUE ORANGE?</div>
          <h2 data-reveal>Pequenas escolhas.<br /><span>Boa energia.</span></h2>
          <p data-reveal>Seu ritual de frescor ficou mais gostoso — e mais consciente.</p>
        </div>
        <div className="benefit-list">
          <article data-reveal><span className="benefit-icon" data-gesto="girar" aria-hidden="true"><span>✳</span></span><h3>Natural de verdade</h3><p>O sabor da laranja como ele deve ser: vivo, cítrico e direto ao ponto.</p></article>
          <article data-reveal><span className="benefit-icon" data-gesto="volta" aria-hidden="true"><span>↻</span></span><h3>Devolveu, ganhou</h3><p>Devolva sua garrafa e receba cashback conforme as regras do programa.</p></article>
          <article data-reveal><span className="benefit-icon" data-gesto="ritmo" aria-hidden="true"><span>⌁</span></span><h3>Seu ritmo, suas regras</h3><p>Compre quando quiser ou escolha uma assinatura recorrente.</p></article>
          <article data-reveal><span className="benefit-icon" data-gesto="pulsar" aria-hidden="true"><span>◉</span></span><h3>Conectada com você</h3><p>A tecnologia NFC aproxima a garrafa da sua experiência digital.</p></article>
        </div>
      </section>

      {/* Planos com preços de demonstração e benefícios essenciais. */}
      <section className="plan-section section-shell" id="planos" ref={planosRef}>
        <div className="plan-heading">
          <div className="section-kicker" data-reveal>03 / ESCOLHA SEU ORANGE</div>
          <span className="fictional-prices" data-reveal>PREÇOS FICTÍCIOS · ESTUDO DE LAYOUT</span>
          <h2 data-reveal>Seu próximo gole<br /><span>começa aqui.</span></h2>
          <p data-reveal>Sem complicação. Escolha o formato que combina com você.</p>
        </div>
        <div className="plans-grid">
          {plans.map((plan, index) => (
            <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name} data-reveal data-tilt>
              {plan.featured && <div className="popular-tag"><Sparkles size={13} aria-hidden="true" /> O MAIS ESCOLHIDO</div>}
              <div className="plan-topline"><span>{plan.name}</span><span>0{index + 1}</span></div>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price"><span data-count>{plan.amount}</span><small>{plan.detail}</small></div>
              {/* No fluxo do card (não mais absoluto), para nunca ficar por cima do número do plano. */}
              <span className="plan-fictional">Valor fictício</span>
              <div className="plan-divider" />
              <ul>{plan.perks.map((perk) => <li key={perk}><Check size={15} aria-hidden="true" />{perk}</li>)}</ul>
              <a className={plan.featured ? "button button-dark plan-button" : "button button-outline plan-button"} href={`mailto:oi@orange.com.br?subject=${encodeURIComponent(`Quero conhecer o plano ${plan.name}`)}`}>
                Tenho interesse <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
        <p className="plan-note" data-reveal>* Preços fictícios, usados apenas como exemplo visual. Não representam uma oferta comercial real.</p>
      </section>

      {/* Avaliações em cartões sobrepostos com navegação por setas e indicadores. */}
      <section className="reviews-section section-shell" id="avaliacoes">
        <div className="reviews-top">
          <div>
            <div className="section-kicker" data-reveal>04 / QUEM JÁ SENTIU</div>
            <h2 data-reveal>Uma experiência Orange.<br /><span>Em demonstração.</span></h2>
          </div>
        </div>
        <div data-reveal><StaggerTestimonials /></div>
      </section>

      {/* Perguntas frequentes em formato expansível. */}
      <section className="faq-section section-shell" id="duvidas">
        <div>
          <div className="section-kicker" data-reveal>SEM DÚVIDAS</div>
          <h2 data-reveal>Quer saber<br /><span>mais alguma coisa?</span></h2>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <article className="faq-item" key={item.q} data-reveal>
              <details>
                <summary>{item.q}<span className="faq-icon" aria-hidden="true" /></summary>
                <p>{item.a}</p>
              </details>
            </article>
          ))}
        </div>
      </section>

      {/* Chamada final curta, mantendo a paleta e o estilo da marca. */}
      <section className="closing-cta">
        <div className="closing-glow" aria-hidden="true" />
        <div className="section-kicker" data-reveal>O NATURAL PODE IR MAIS LONGE</div>
        <h2 data-reveal>Deixa o dia<br />mais <span>Orange.</span></h2>
        <a className="button button-dark" href="#planos" data-reveal data-magnetic>Encontrar meu Orange <ArrowRight size={17} aria-hidden="true" /></a>
        <div className="closing-fruit" aria-hidden="true">✳</div>
      </section>
      </main>

      {/* Rodapé curto para encerrar a página sem adicionar outra chamada extensa. */}
      <footer className="footer section-shell">
        <div className="footer-main" data-reveal>
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

// Card da seção 01; usado para o card atual e para o que está sendo jogado para fora.
function StoryCardView({ card, className = "", ...resto }: { card: StoryCard } & HTMLAttributes<HTMLElement>) {
  return (
    <article className={`story-card ${card.style} ${className}`} {...resto}>
      <span className="card-number">{card.number}</span>
      <div className={artClass[card.artType]} aria-hidden="true">
        {card.artText}
      </div>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
      <span className="card-caption">{card.caption}</span>
    </article>
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
