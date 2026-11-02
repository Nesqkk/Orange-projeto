import { useEffect, type RefObject } from "react";

// Puxa de leve os botões com `data-magnetic` em direção ao cursor quando ele chega perto.
// Só escreve variáveis CSS (--mag-x, --mag-y); o deslocamento em si fica no CSS (seção 20 de site.css).
// Fica desligado em telas de toque e para quem prefere menos movimento.
const ALCANCE = 70; // px além da borda do botão em que o ímã começa a agir
const FORCA = 0.3; // fração da distância até o centro que o botão acompanha
const MAXIMO = 12; // px

export function useBotoesMagneticos(raizRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const botoes = [...raiz.querySelectorAll<HTMLElement>("[data-magnetic]")];
    let frame = 0;
    let ultimo: PointerEvent | null = null;

    const soltar = (el: HTMLElement) => {
      el.classList.remove("is-magnetic");
      el.style.setProperty("--mag-x", "0px");
      el.style.setProperty("--mag-y", "0px");
    };

    // No máximo 1 atualização por frame. A caixa é medida sem o deslocamento que está na tela agora
    // (lido do estilo calculado, que acompanha a transição), senão o botão "foge" do próprio centro.
    const aplicar = () => {
      frame = 0;
      if (!ultimo) return;
      for (const el of botoes) {
        const caixa = el.getBoundingClientRect();
        const [deslocX = 0, deslocY = 0] = getComputedStyle(el).translate.split(" ").map((v) => parseFloat(v) || 0);
        const centroX = caixa.left - deslocX + caixa.width / 2;
        const centroY = caixa.top - deslocY + caixa.height / 2;
        const dx = ultimo.clientX - centroX;
        const dy = ultimo.clientY - centroY;
        const perto = Math.abs(dx) < caixa.width / 2 + ALCANCE && Math.abs(dy) < caixa.height / 2 + ALCANCE;
        if (!perto) {
          if (el.classList.contains("is-magnetic")) soltar(el);
          continue;
        }
        const limitar = (v: number) => Math.max(-MAXIMO, Math.min(MAXIMO, v * FORCA));
        el.classList.add("is-magnetic");
        el.style.setProperty("--mag-x", `${limitar(dx).toFixed(1)}px`);
        el.style.setProperty("--mag-y", `${limitar(dy).toFixed(1)}px`);
      }
    };

    const mover = (e: PointerEvent) => {
      ultimo = e;
      if (!frame) frame = requestAnimationFrame(aplicar);
    };
    // Rolar com o mouse parado também muda a distância até os botões.
    const rolar = () => { if (ultimo && !frame) frame = requestAnimationFrame(aplicar); };
    // Mouse saiu da janela: todos voltam ao lugar.
    const sair = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      ultimo = null;
      botoes.forEach(soltar);
    };

    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("scroll", rolar, { passive: true });
    document.documentElement.addEventListener("pointerleave", sair);
    return () => {
      sair();
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("scroll", rolar);
      document.documentElement.removeEventListener("pointerleave", sair);
    };
  }, [raizRef]);
}
