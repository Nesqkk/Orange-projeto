import { useEffect, type RefObject } from "react";
import { ATRIBUTO_ESPERA, EVENTO_SUCO_ESCORREU } from "@/lib/use-suco-derramando";

// Faz o número dentro de cada elemento com `data-count` subir de 0 até o valor escrito no HTML
// quando ele entra na tela. O texto ao redor é mantido: "R$ 34,90" conta só o "34,90".
// O valor final já vem no HTML, então sem JS (ou com "reduzir movimento") o número aparece pronto.
// Embaixo do suco derramando (use-suco-derramando), a contagem espera ele escorrer.
const DURACAO = 1400; // ms
const ATRASO = 250; // ms — espera o card começar a aparecer (revelar ao rolar) antes de contar

const formatar = (valor: number, casas: number) =>
  valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function useNumerosQueContam(raizRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz || !("IntersectionObserver" in window)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const frames = new Set<number>();
    const contados = new Set<Element>();
    const emAndamento = new Map<HTMLElement, string>(); // elemento → texto final, para restaurar se a página desmontar no meio

    const contar = (el: HTMLElement) => {
      const textoFinal = el.textContent ?? "";
      const achado = textoFinal.match(/\d[\d.]*(?:,\d+)?/); // número no formato brasileiro (1.234,56)
      if (!achado || achado.index === undefined) return;
      const [antes, depois] = [textoFinal.slice(0, achado.index), textoFinal.slice(achado.index + achado[0].length)];
      const casas = achado[0].split(",")[1]?.length ?? 0;
      const alvo = Number(achado[0].replace(/\./g, "").replace(",", "."));

      // Trava a largura do valor final para o "/ mês" ao lado não pular enquanto os dígitos mudam.
      el.style.display = "inline-block";
      el.style.minWidth = `${el.getBoundingClientRect().width}px`;
      el.textContent = antes + formatar(0, casas) + depois;
      emAndamento.set(el, textoFinal);

      const inicio = performance.now() + ATRASO;
      const passo = (agora: number) => {
        const t = Math.min(1, Math.max(0, (agora - inicio) / DURACAO));
        const suave = 1 - Math.pow(1 - t, 3); // desacelera no fim
        el.textContent = antes + formatar(alvo * suave, casas) + depois;
        if (t < 1) frames.add(requestAnimationFrame(passo));
        else {
          el.textContent = textoFinal; // termina exatamente no texto original
          emAndamento.delete(el);
        }
      };
      frames.add(requestAnimationFrame(passo));
    };

    const observer = new IntersectionObserver((entradas) => {
      entradas.filter((e) => e.isIntersecting && !e.target.closest(`[${ATRIBUTO_ESPERA}]`)).forEach((e) => {
        observer.unobserve(e.target);
        contados.add(e.target);
        contar(e.target as HTMLElement);
      });
    }, { rootMargin: "0px 0px -12% 0px" });

    raiz.querySelectorAll("[data-count]").forEach((el) => observer.observe(el));
    // Observar de novo faz o observer conferir na hora o que já está na tela.
    const liberar = () => raiz.querySelectorAll("[data-count]").forEach((el) => {
      if (contados.has(el)) return;
      observer.unobserve(el);
      observer.observe(el);
    });
    window.addEventListener(EVENTO_SUCO_ESCORREU, liberar);
    return () => {
      observer.disconnect();
      window.removeEventListener(EVENTO_SUCO_ESCORREU, liberar);
      frames.forEach((id) => cancelAnimationFrame(id));
      emAndamento.forEach((texto, el) => { el.textContent = texto; });
    };
  }, [raizRef]);
}
