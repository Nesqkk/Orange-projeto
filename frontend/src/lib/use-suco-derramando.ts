import { useEffect, type RefObject } from "react";

// Suco derramando na tela: na primeira vez que a pessoa chega na seção-alvo (os planos), o suco cai
// do topo e cobre a tela inteira, com borda ondulada e gotas na frente; depois escorre para baixo
// e o conteúdo da seção aparece por baixo dele. Acontece uma vez por carregamento da página.
// Os tempos ficam só no CSS (seção 22 de site.css); o JS acompanha as fases pelos eventos de animação.
// A camada não captura cliques nem trava o scroll. Com "reduzir movimento", não acontece.

// Enquanto o suco cobre a tela, a seção-alvo fica com este atributo e o revelar ao rolar e os
// números que contam esperam; quando ele começa a escorrer, este evento libera os dois.
export const ATRIBUTO_ESPERA = "data-suco-espera";
export const EVENTO_SUCO_ESCORREU = "suco:escorreu";

export function useSucoDerramando(camadaRef: RefObject<HTMLElement | null>, alvoRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const camada = camadaRef.current;
    const alvo = alvoRef.current;
    if (!camada || !alvo || !("IntersectionObserver" in window)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const liberar = () => {
      if (!alvo.hasAttribute(ATRIBUTO_ESPERA)) return;
      alvo.removeAttribute(ATRIBUTO_ESPERA);
      window.dispatchEvent(new Event(EVENTO_SUCO_ESCORREU));
    };

    // Fase 2 (escorrer) começou: o conteúdo pode aparecer. Fase 2 terminou: a camada some.
    const aoComecar = (e: AnimationEvent) => { if (e.animationName === "derrame-escoar") liberar(); };
    const aoTerminar = (e: AnimationEvent) => {
      if (e.animationName === "derrame-escoar") camada.classList.remove("is-derramando");
    };
    camada.addEventListener("animationstart", aoComecar);
    camada.addEventListener("animationend", aoTerminar);

    // Dispara assim que o topo da seção encosta no fim da tela, antes do conteúdo dela aparecer.
    const observer = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      observer.disconnect();
      alvo.setAttribute(ATRIBUTO_ESPERA, "");
      camada.classList.add("is-derramando");
    });
    observer.observe(alvo);

    return () => {
      observer.disconnect();
      camada.removeEventListener("animationstart", aoComecar);
      camada.removeEventListener("animationend", aoTerminar);
      camada.classList.remove("is-derramando");
      liberar();
    };
  }, [camadaRef, alvoRef]);
}
