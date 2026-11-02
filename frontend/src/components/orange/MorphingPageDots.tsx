"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type MorphingPageDotsProps = {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
};

/** Navegação compacta com setas e indicadores animados para a avaliação ativa. */
export default function MorphingPageDots({ total, page, onPageChange }: MorphingPageDotsProps) {
  const goPrev = () => onPageChange(Math.max(0, page - 1));
  const goNext = () => onPageChange(Math.min(total - 1, page + 1));

  return (
    <div className="morphing-dots" aria-label="Navegação das avaliações">
      <button type="button" onClick={goPrev} disabled={page === 0} aria-label="Avaliação anterior">
        <ChevronLeft size={20} />
      </button>
      <div className="morphing-dots-list">
        {Array.from({ length: total }).map((_, index) => (
          <button
            type="button"
            key={index}
            className={`morphing-dot ${index === page ? "active" : ""}`}
            onClick={() => onPageChange(index)}
            aria-label={`Ir para avaliação ${index + 1}`}
            aria-current={index === page ? "step" : undefined}
          />
        ))}
      </div>
      <button type="button" onClick={goNext} disabled={page === total - 1} aria-label="Próxima avaliação">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
