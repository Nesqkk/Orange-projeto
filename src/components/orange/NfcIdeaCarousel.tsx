"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Smartphone, Globe2, Sparkles } from "lucide-react";

const etapas = [
  {
    icon: Smartphone,
    title: "Aproxime a garrafa",
    description:
      "A proposta é integrar um chip NFC à embalagem. Com um celular compatível, basta aproximá-lo para iniciar a experiência.",
  },
  {
    icon: Globe2,
    title: "Abra a experiência Orange",
    description:
      "A leitura poderá levar a uma página digital ligada à garrafa, com conteúdo pensado para acompanhar o produto.",
  },
  {
    icon: Sparkles,
    title: "Continue a conexão",
    description:
      "Informações, novidades e recursos digitais podem fazer parte da experiência. As funções finais serão divulgadas no lançamento.",
  },
];

export default function NfcIdeaCarousel() {
  const [etapaAtual, setEtapaAtual] = useState(0);
  const inicioToque = useRef<number | null>(null);
  const etapa = etapas[etapaAtual];
  const Icone = etapa.icon;

  const navegar = (direcao: number) => {
    setEtapaAtual((atual) => (atual + direcao + etapas.length) % etapas.length);
  };

  return (
    <div
      className="nfc-carousel"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Como pode funcionar a experiência NFC Orange"
      onTouchStart={(event) => {
        inicioToque.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (inicioToque.current === null) return;
        const deslocamento = inicioToque.current - (event.changedTouches[0]?.clientX ?? inicioToque.current);
        if (Math.abs(deslocamento) > 45) navegar(deslocamento > 0 ? 1 : -1);
        inicioToque.current = null;
      }}
    >
      <div className="nfc-carousel-track" aria-live="polite" aria-atomic="true">
        <article className="nfc-carousel-card" key={etapaAtual}>
          <div className="nfc-carousel-icon" aria-hidden="true">
            <Icone size={25} strokeWidth={1.5} />
          </div>
          <h3>{etapa.title}</h3>
          <p>{etapa.description}</p>
        </article>
      </div>

      <div className="nfc-carousel-controls">
        <div className="nfc-carousel-dots" aria-label="Escolher etapa">
          {etapas.map((item, index) => (
            <button
              key={item.title}
              type="button"
              className={`nfc-carousel-dot ${index === etapaAtual ? "active" : ""}`}
              aria-label={`Mostrar: ${item.title}`}
              aria-current={index === etapaAtual ? "step" : undefined}
              onClick={() => setEtapaAtual(index)}
            />
          ))}
        </div>
        <div className="nfc-carousel-arrows">
          <button type="button" aria-label="Etapa anterior" onClick={() => navegar(-1)}>
            <ArrowLeft size={17} />
          </button>
          <button type="button" aria-label="Próxima etapa" onClick={() => navegar(1)}>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
