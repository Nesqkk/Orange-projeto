import { useEffect, type RefObject } from "react";

// Inclina em 3D os elementos com o atributo `data-tilt` na direção do mouse, com um brilho que segue o cursor.
// Só escreve variáveis CSS (--tilt-x, --tilt-y, --glare-x, --glare-y); quem monta o `transform` é o CSS
// (seção 16 de site.css), assim o hover e a escala do Orange Club continuam valendo junto com a inclinação.
// Fica desligado em telas de toque e para quem prefere menos movimento.
const INCLINACAO_MAXIMA = 7; // graus

export function useInclinacao3D(raizRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const limpezas = [...raiz.querySelectorAll<HTMLElement>("[data-tilt]")].map((el) => {
      let frame = 0;
      let ultimo: PointerEvent | null = null;

      // No máximo 1 atualização por frame, mesmo com o mouse disparando vários eventos.
      const aplicar = () => {
        frame = 0;
        if (!ultimo) return;
        const caixa = el.getBoundingClientRect();
        const x = (ultimo.clientX - caixa.left) / caixa.width; // 0 → 1
        const y = (ultimo.clientY - caixa.top) / caixa.height;
        el.style.setProperty("--tilt-x", `${((0.5 - y) * 2 * INCLINACAO_MAXIMA).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${((x - 0.5) * 2 * INCLINACAO_MAXIMA).toFixed(2)}deg`);
        el.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
      };
      const mover = (e: PointerEvent) => {
        ultimo = e;
        el.classList.add("is-tilting");
        if (!frame) frame = requestAnimationFrame(aplicar);
      };
      // Ao sair, volta devagar para a posição reta (a transição normal do card cuida disso).
      const sair = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        ultimo = null;
        el.classList.remove("is-tilting");
        el.style.setProperty("--tilt-x", "0deg");
        el.style.setProperty("--tilt-y", "0deg");
      };

      el.addEventListener("pointermove", mover);
      el.addEventListener("pointerleave", sair);
      return () => {
        sair();
        el.removeEventListener("pointermove", mover);
        el.removeEventListener("pointerleave", sair);
      };
    });

    return () => limpezas.forEach((limpar) => limpar());
  }, [raizRef]);
}
