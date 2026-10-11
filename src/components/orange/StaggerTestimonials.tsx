"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import MorphingPageDots from "./MorphingPageDots";

// Depoimentos fictícios para demonstrar o layout. Substituir por relatos reais autorizados.
const testimonials = [
  { quote: "Finalmente um suco que tem gosto de fruta de verdade. Virou parte da minha manhã.", name: "Marina S.", role: "Cliente Orange Club", initials: "MS" },
  { quote: "A garrafa é linda, o sistema de devolução é fácil e o suco é muito bom.", name: "Caio R.", role: "Cliente desde 2026", initials: "CR" },
  { quote: "Curti a ideia de consumir melhor sem precisar mudar toda a minha rotina.", name: "Bia M.", role: "Cliente Orange+", initials: "BM" },
];

/** Carrossel de depoimentos com cartões sobrepostos e navegação por pontos. */
export default function StaggerTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = testimonials[activeIndex];
  const previousIndex = (activeIndex - 1 + testimonials.length) % testimonials.length;
  const nextIndex = (activeIndex + 1) % testimonials.length;

  return (
    <div className="testimonial-carousel">
      <div className="testimonial-stage">
        {[previousIndex, activeIndex, nextIndex].map((index, position) => {
          const review = testimonials[index];
          const cardPosition = position === 0 ? "previous" : position === 1 ? "current" : "next";
          return (
            <button
              type="button"
              key={review.initials}
              className={`testimonial-card ${cardPosition}`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Ver avaliação de ${review.name}`}
              aria-pressed={index === activeIndex}
            >
              <span className="testimonial-quote-mark">“</span>
              <span className="testimonial-stars" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }).map((_, starIndex) => <Star key={starIndex} size={13} fill="currentColor" />)}
              </span>
              <span className="testimonial-quote">“{review.quote}”</span>
              <span className="testimonial-author">
                <span className="testimonial-avatar">{review.initials}</span>
                <span><strong>{review.name}</strong><small>{review.role}</small></span>
              </span>
            </button>
          );
        })}
      </div>
      <MorphingPageDots total={testimonials.length} page={activeIndex} onPageChange={setActiveIndex} />
      <p className="review-disclaimer">Depoimentos fictícios usados apenas para demonstrar o layout. Serão substituídos por avaliações reais autorizadas antes da publicação.</p>
      <span className="sr-only" aria-live="polite">Avaliação atual: {active.name}</span>
    </div>
  );
}
