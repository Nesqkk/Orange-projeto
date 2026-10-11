"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowDownRight, ArrowRight, Check, ChevronDown, Menu, Moon, Sun, Sparkles, Star, X } from "lucide-react";

const plans = [
  { name: "Solo", amount: "R$ 9,90", detail: "por garrafa", description: "Pra matar a sede de um jeito melhor.", perks: ["Suco 100% natural", "Laranja de verdade", "Embalagem retornável"], featured: false },
  { name: "Orange Club", amount: "R$ 34,90", detail: "/ mês", description: "Sua dose de frescor, sem complicação.", perks: ["4 garrafas por mês", "Cashback na devolução", "Acesso a edições especiais"], featured: true },
  { name: "Orange +", amount: "R$ 44,90", detail: "/ mês", description: "Mais cuidado na sua rotina.", perks: ["4 garrafas enriquecidas com colágeno", "Cashback na devolução", "Entrega recorrente"], featured: false },
];

const reviews = [
  { quote: "Finalmente um suco que tem gosto de fruta de verdade. Virou parte da minha manhã.", name: "Marina S.", role: "Cliente Orange Club", initials: "MS" },
  { quote: "A garrafa é linda, o sistema de devolução é fácil e o suco é absurdo de bom.", name: "Caio R.", role: "Cliente desde 2026", initials: "CR" },
  { quote: "Curti a ideia de consumir melhor sem precisar mudar toda a minha rotina.", name: "Bia M.", role: "Cliente Orange +", initials: "BM" },
];

export default function Home() {
  const [light, setLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeReview, setActiveReview] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [scrollStage, setScrollStage] = useState(0);
  const themeClass = `${light ? "site light" : "site"} scroll-stage-${scrollStage}`;

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
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="navbar">
        <a className="brand" href="#inicio" aria-label="Orange — início"><Image src="/orange-logo.png" alt="Logo Orange" width={44} height={44} priority /><span>orange<span className="brand-dot">.</span></span></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          <a href="#conceito" onClick={() => setMenuOpen(false)}>A experiência</a><a href="#beneficios" onClick={() => setMenuOpen(false)}>Por que Orange?</a><a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a><a href="#avaliacoes" onClick={() => setMenuOpen(false)}>Avaliações</a>
          <a className="nav-cta" href="#planos" onClick={() => setMenuOpen(false)}>Quero experimentar <ArrowRight size={15} /></a>
        </nav>
        <div className="nav-actions"><button className="theme-toggle" onClick={() => setLight(!light)} aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}>{light ? <Moon size={17} /> : <Sun size={17} />}</button><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X /> : <Menu />}</button></div>
      </header>

      <section className="hero section-shell" id="inicio">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> NATURALMENTE FORA DO ÓBVIO</div><h1>O lado mais <span>vivo</span><br />da sua rotina.</h1><p className="hero-description">Laranja de verdade. Sabor que desperta. Uma experiência feita pra quem quer sentir a diferença em cada gole.</p><div className="hero-actions"><a className="button button-orange" href="#planos">Descubra Orange <ArrowRight size={17} /></a><a className="text-link" href="#conceito">Conheça a ideia <ArrowDownRight size={16} /></a></div><div className="hero-proof"><div className="proof-avatars"><span>O</span><span>+</span><span>100</span></div><div><div className="stars"><Star /><Star /><Star /><Star /><Star /></div><p>Feito pra quem escolhe melhor.</p></div></div></div>
        <div className="hero-visual" aria-label="Garrafa Orange ilustrativa"><div className="visual-orbit orbit-a"/><div className="visual-orbit orbit-b"/><div className="orange-glow"/><div className="floating-label label-top"><Sparkles size={14} /> 100% natural</div><div className="bottle-stage"><div className="bottle-cap"/><div className="bottle-neck"/><div className="bottle"><div className="bottle-shine"/><div className="bottle-liquid"/><div className="bottle-label"><span className="label-small">FRESHLY PRESSED</span><strong>orange<span>.</span></strong><i>PURE ORANGE JUICE</i><div className="label-fruit">◉</div><small>300 ml · sem mistério</small></div><div className="bottle-base"/></div></div><div className="floating-label label-bottom"><span className="tiny-orange"/> Sabor de fruta. Sem atalhos.</div><div className="visual-index">01 <span /> 04</div></div>
        <a href="#conceito" className="scroll-cue"><span>SCROLL PRA SENTIR</span><ChevronDown size={16} /></a>
      </section>

      <section className="marquee" aria-label="Manifesto Orange"><div className="marquee-track">{Array.from({ length: 4 }).map((_, i) => <span key={i}>FRUTA DE VERDADE <b>✳</b> FRESCOR SEM FILTRO <b>✳</b> SEU DIA, MAIS VIVO <b>✳</b></span>)}</div></section>

      <section className="story section-shell" id="conceito"><div className="section-kicker">01 / A EXPERIÊNCIA</div><div className="story-grid"><h2>Não é só suco.<br /><span>É sentir o agora.</span></h2><div className="story-text"><p>A Orange nasceu de uma ideia simples: deixar o natural ser extraordinário. Sem complicar o que já é bom — só fruta, frescor e um jeito mais inteligente de consumir.</p><a className="underlined-link" href="#beneficios">Conheça nosso jeito <ArrowRight size={16} /></a></div></div><div className="story-cards"><article className="story-card card-orange"><div className="card-number">01</div><div className="fruit-symbol">✳</div><h3>Fruta de verdade.</h3><p>Suco de laranja 100% natural, com sabor fresco e sem enrolação.</p><span className="card-caption">SIMPLES ASSIM</span></article><article className="story-card card-dark"><div className="card-number">02</div><div className="circle-art"><span>O</span></div><h3>Design com propósito.</h3><p>Uma garrafa pensada pra acompanhar seu ritmo — e voltar pro ciclo.</p><span className="card-caption">MENOS DESCARTE</span></article><article className="story-card card-cream"><div className="card-number">03</div><div className="spark-art">✦</div><h3>Um cuidado a mais.</h3><p>Uma opção com colágeno pra quem quer explorar novas possibilidades.</p><span className="card-caption">VOCÊ ESCOLHE</span></article></div></section>

      <section className="benefits section-shell" id="beneficios"><div className="benefit-heading"><div><div className="section-kicker">02 / POR QUE ORANGE?</div><h2>Pequenas escolhas.<br /><span>Boa energia.</span></h2></div><p>Seu ritual de frescor ficou mais gostoso — e mais consciente.</p></div><div className="benefit-list"><article><span className="benefit-icon">✳</span><div><h3>Natural de verdade</h3><p>O sabor da laranja como ele deve ser: vivo, cítrico e direto ao ponto.</p></div><span className="benefit-arrow"><ArrowRight /></span></article><article><span className="benefit-icon">↻</span><div><h3>Devolveu, ganhou</h3><p>Devolva sua garrafa e receba cashback. Seu próximo Orange começa aqui.</p></div><span className="benefit-arrow"><ArrowRight /></span></article><article><span className="benefit-icon">⌁</span><div><h3>Seu ritmo, suas regras</h3><p>Escolha comprar quando quiser ou deixar seu estoque chegar com uma assinatura.</p></div><span className="benefit-arrow"><ArrowRight /></span></article><article><span className="benefit-icon">◉</span><div><h3>Conectada com você</h3><p>A tecnologia NFC aproxima a garrafa da sua experiência digital.</p></div><span className="benefit-arrow"><ArrowRight /></span></article></div></section>

      <section className="plan-section section-shell" id="planos"><div className="plan-heading"><div className="section-kicker">03 / ESCOLHA SEU ORANGE</div><span className="fictional-prices">PREÇOS FICTÍCIOS · ESTUDO DE LAYOUT</span><h2>Seu próximo gole<br /><span>começa aqui.</span></h2><p>Sem complicação. Escolha o formato que combina com você.</p></div><div className="plans-grid">{plans.map((plan, i) => <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>{plan.featured && <div className="popular-tag">O FAVORITO <Sparkles size={13} /></div>}<div className="plan-topline"><span>{plan.name}</span><span>0{i + 1}</span></div><p className="plan-description">{plan.description}</p><div className="plan-price">{plan.amount}<small>{plan.detail}</small></div><div className="plan-divider"/><ul>{plan.perks.map(perk => <li key={perk}><Check size={15} />{perk}</li>)}</ul><a className={plan.featured ? "button button-orange plan-button" : "button button-outline plan-button"} href={`mailto:oi@orange.com.br?subject=${encodeURIComponent(`Quero conhecer o plano ${plan.name}`)}`}>Tenho interesse <ArrowRight size={16} /></a></article>)}</div><p className="plan-note">* Todos os preços desta página são fictícios e servem apenas como exemplo visual. Não representam uma oferta comercial real.</p></section>

      <section className="reviews-section section-shell" id="avaliacoes"><div className="reviews-top"><div><div className="section-kicker">04 / QUEM JÁ SENTIU</div><h2>Uma experiência Orange.<br /><span>Em demonstração.</span></h2></div><div className="review-controls"><button onClick={() => setActiveReview((activeReview + reviews.length - 1) % reviews.length)} aria-label="Avaliação anterior">←</button><button onClick={() => setActiveReview((activeReview + 1) % reviews.length)} aria-label="Próxima avaliação">→</button></div></div><div className="review-feature"><div className="quote-mark">“</div><div className="review-content"><div className="stars"><Star /><Star /><Star /><Star /><Star /></div><blockquote>{reviews[activeReview].quote}</blockquote><div className="review-person"><div className="review-avatar">{reviews[activeReview].initials}</div><div><strong>{reviews[activeReview].name}</strong><span>{reviews[activeReview].role}</span></div></div></div><div className="review-pagination">0{activeReview + 1}<span />0{reviews.length}</div></div><p className="review-disclaimer">Avaliações fictícias usadas apenas para demonstrar o layout. Serão substituídas por depoimentos reais autorizados antes da publicação.</p></section>

      <section className="faq-section section-shell"><div><div className="section-kicker">SEM DÚVIDAS</div><h2>Quer saber<br /><span>mais alguma coisa?</span></h2></div><div className="faq-list">{[{q:"O suco é 100% natural?",a:"Sim. A proposta da Orange é oferecer suco de laranja 100% natural. Informações finais de ingredientes e conservação serão exibidas no rótulo do produto."},{q:"Como funciona a devolução da garrafa?",a:"A ideia é permitir a devolução em pontos participantes e oferecer cashback conforme as regras do programa, que serão publicadas no lançamento."},{q:"Qual é a diferença do Orange +?",a:"É uma versão opcional enriquecida com colágeno. A composição e as informações nutricionais estarão disponíveis na embalagem."}].map((item, i) => <article className={`faq-item ${faqOpen === i ? "faq-active" : ""}`} key={item.q}><button onClick={() => setFaqOpen(faqOpen === i ? null : i)}><span>{item.q}</span><span>{faqOpen === i ? "−" : "+"}</span></button>{faqOpen === i && <p>{item.a}</p>}</article>)}</div></section>

      <section className="closing-cta"><div className="closing-glow"/><div className="section-kicker">O NATURAL PODE IR MAIS LONGE</div><h2>Deixa o dia<br />mais <span>Orange.</span></h2><a className="button button-dark" href="#planos">Encontrar meu Orange <ArrowRight size={17} /></a><div className="closing-fruit">✳</div></section>

      <footer className="footer section-shell"><div className="footer-main"><a className="brand" href="#inicio"><Image src="/orange-logo.png" alt="Logo Orange" width={38} height={38} /><span>orange<span className="brand-dot">.</span></span></a><p>Fruta de verdade.<br />Uma vida mais viva.</p><a href="mailto:oi@orange.com.br">oi@orange.com.br <ArrowRight size={14} /></a></div><div className="footer-bottom"><span>© 2026 Orange. Feito com frescor.</span><div><a href="#conceito">Nossa ideia</a><a href="#planos">Planos</a><a href="#inicio">Voltar ao topo ↑</a></div><span>UM GOLE DE CADA VEZ.</span></div></footer>
    </main>
  );
}
