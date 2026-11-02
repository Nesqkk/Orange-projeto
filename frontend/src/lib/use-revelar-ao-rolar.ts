import { useEffect, type RefObject } from "react";
import { ATRIBUTO_ESPERA, EVENTO_SUCO_ESCORREU } from "@/lib/use-suco-derramando";

// Faz cada elemento com o atributo `data-reveal` subir e aparecer quando entra na tela.
// Elementos que entram juntos (ex.: os cards de uma grade) aparecem em sequência, um depois do outro.
// A animação usa a Web Animations API só em `opacity` e `translate`, então não briga com os
// `transform`, `transition` e `animation` que já existem no CSS (hover dos planos, brilho do destaque etc.).
// Quem prefere menos movimento vê tudo direto, sem esconder nada.
// O que estiver embaixo do suco derramando (use-suco-derramando) espera ele escorrer para aparecer.
export function useRevelarAoRolar(raizRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || !("IntersectionObserver" in window)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Só esconde os elementos depois que o JS está pronto: sem JS, a página aparece inteira.
    raiz.classList.add("reveal-ready");

    const observer = new IntersectionObserver((entradas) => {
      const visiveis = entradas
        .filter((e) => e.isIntersecting && !e.target.closest(`[${ATRIBUTO_ESPERA}]`))
        .map((e) => e.target as HTMLElement);
      // Ordem do documento, para a sequência seguir a leitura (cima → baixo, esquerda → direita).
      visiveis.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      visiveis.forEach((el, ordem) => {
        observer.unobserve(el);
        el.animate(
          [{ opacity: 0, translate: "0 32px" }, { opacity: 1, translate: "0 0" }],
          { duration: 750, delay: Math.min(ordem, 6) * 90, easing: "cubic-bezier(.2, .8, .2, 1)", fill: "backwards" },
        );
        el.classList.add("is-revealed");
      });
    }, { rootMargin: "0px 0px -12% 0px" });

    raiz.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    // Observar de novo faz o observer conferir na hora o que já está na tela.
    const liberar = () => raiz.querySelectorAll("[data-reveal]:not(.is-revealed)").forEach((el) => {
      observer.unobserve(el);
      observer.observe(el);
    });
    window.addEventListener(EVENTO_SUCO_ESCORREU, liberar);
    return () => {
      observer.disconnect();
      window.removeEventListener(EVENTO_SUCO_ESCORREU, liberar);
      raiz.classList.remove("reveal-ready");
    };
  }, [raizRef]);
}
