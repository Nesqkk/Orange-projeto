"use client";

import { useEffect, useState } from "react";

const cards = [
  {
    tone: "card-orange",
    number: "01",
    artwork: "fruit-symbol",
    symbol: "✳",
    title: "Fruta de verdade.",
    description: "Suco de laranja 100% natural, com sabor fresco e sem enrolação.",
    caption: "SIMPLES ASSIM",
  },
  {
    tone: "card-dark",
    number: "02",
    artwork: "circle-art",
    symbol: "O",
    title: "Design com propósito.",
    description: "Uma garrafa pensada pra acompanhar seu ritmo — e voltar pro ciclo.",
    caption: "MENOS DESCARTE",
  },
  {
    tone: "card-cream",
    number: "03",
    artwork: "spark-art",
    symbol: "✦",
    title: "Um cuidado a mais.",
    description: "Uma opção com colágeno pra quem quer explorar novas possibilidades.",
    caption: "VOCÊ ESCOLHE",
  },
];

export default function StoryCardsCarousel() {
  const [activeCard, setActiveCard] = useState(0);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    if (expandedCard !== null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveCard((current) => (current + 1) % cards.length);
    }, 8500);

    return () => window.clearInterval(timer);
  }, [expandedCard]);

  const expandWithKeyboard = (index: number) => {
    setActiveCard(index);
    setExpandedCard(index);
  };

  return (
    <div className={`story-carousel ${expandedCard !== null ? "has-expanded-card" : ""}`}>
      <div className="story-cards">
        {cards.map((card, index) => (
          <article
            className={[
              "story-card",
              card.tone,
              `story-card-slot-${(index - activeCard + cards.length) % cards.length}`,
              index === activeCard ? "is-active" : "",
              index === expandedCard ? "is-expanded" : "",
            ].filter(Boolean).join(" ")}
            key={card.title}
            role="button"
            tabIndex={0}
            aria-expanded={index === expandedCard}
            aria-label={`${card.title} Mostrar detalhes`}
            onMouseEnter={() => {
              if (window.matchMedia("(hover: hover)").matches) expandWithKeyboard(index);
            }}
            onMouseLeave={() => setExpandedCard(null)}
            onFocus={() => {
              if (window.matchMedia("(hover: hover)").matches) expandWithKeyboard(index);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setExpandedCard(null);
              }
            }}
            onClick={() => {
              if (window.matchMedia("(hover: none)").matches) {
                setActiveCard(index);
                setExpandedCard((current) => current === index ? null : index);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setExpandedCard((current) => current === index ? null : index);
                setActiveCard(index);
              }
            }}
          >
            <div className="card-number">{card.number}</div>
            {card.artwork === "circle-art" ? (
              <div className={card.artwork}><span>{card.symbol}</span></div>
            ) : (
              <div className={card.artwork}>{card.symbol}</div>
            )}
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <span className="card-caption">{card.caption}</span>
          </article>
        ))}
      </div>

      <div className="story-carousel-dots" aria-label="Escolher card">
        {cards.map((card, index) => (
          <button
            key={card.title}
            type="button"
            className={index === activeCard ? "active" : ""}
            aria-label={`Mostrar ${card.title}`}
            aria-current={index === activeCard ? "step" : undefined}
            onClick={() => {
              setActiveCard(index);
              setExpandedCard(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}
