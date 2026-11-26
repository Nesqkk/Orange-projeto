"use client";

// Sequência da seção da causa, ao entrar na tela (duas voltas): o pé de laranja cresce e floresce, vira uma família,
// aparece o motion da logo Orange e termina de novo na arvorezinha. Com "reduzir movimento", só a árvore pronta.
import { useEffect, useRef, useState } from "react";
import LogoAnimada from "@/components/orange/LogoAnimada";

const FOLHAS: [number, number, number][] = [
  [150, 128, 62], [98, 150, 44], [202, 150, 44], [120, 98, 40], [182, 100, 40], [150, 78, 36], [84, 186, 30], [216, 186, 30],
];
const FRUTOS: [number, number][] = [[112, 150], [186, 132], [150, 104], [208, 178], [92, 182], [160, 170]];
const FLORES: [number, number][] = [[132, 84], [176, 74], [118, 124], [196, 104], [140, 152], [230, 160], [70, 166]];

type Cena = "arvore" | "familia" | "logo" | "fim";
// a sequência roda duas vezes e para na árvore; cada cena entra antes de a anterior acabar (encaixe)
const SEQ: Cena[] = ["arvore", "familia", "logo", "arvore", "familia", "logo", "fim"];
const DURA: Record<Cena, number> = { arvore: 2300, familia: 1700, logo: 2200, fim: 0 }; // ms na tela

export default function PeDeLaranja() {
  const ref = useRef<HTMLDivElement>(null);
  const [passo, setPasso] = useState(-1); // -1: esperando entrar na tela

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) { setPasso(SEQ.length - 1); return; }
    const timers: number[] = [];
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let t = 0;
      SEQ.forEach((c, i) => { timers.push(window.setTimeout(() => setPasso(i), t)); t += DURA[c]; });
    }, { threshold: 0.45 });
    io.observe(el);
    return () => { io.disconnect(); timers.forEach(clearTimeout); };
  }, []);

  const cena = passo < 0 ? "espera" : SEQ[passo];
  const arvore = cena === "arvore" || cena === "fim" || cena === "espera";
  // chaves: cada vez que a cena volta, ela remonta e a animação recomeça
  const kArvore = passo >= 6 ? 2 : passo >= 3 ? 1 : 0, kFamilia = passo >= 4 ? 1 : 0, kLogo = passo >= 5 ? 1 : 0;
  return (
    <div className="pe-laranja" ref={ref} aria-hidden="true">
      <div className={`pe-cena${arvore ? " ativa" : ""}`}>
        <Arvore key={kArvore} cresce={passo >= 0} />
      </div>
      <div className={`pe-cena${cena === "familia" ? " ativa" : ""}`}>{passo >= 1 && <Familia key={kFamilia} />}</div>
      <div className={`pe-cena pe-cena-logo${cena === "logo" ? " ativa" : ""}`}>{passo >= 2 && <LogoAnimada key={kLogo} altura={170} />}</div>
    </div>
  );
}

function Arvore({ cresce }: { cresce: boolean }) {
  return (
      <svg className={`pe-arvore${cresce ? " cresce" : ""}`} viewBox="0 0 300 340" role="presentation">
        <ellipse className="pe-chao" cx="150" cy="318" rx="92" ry="10" />
        <path className="pe-tronco" d="M150 318 C148 280 154 252 150 214 M150 252 C134 238 120 226 106 200 M151 236 C168 222 184 210 196 188" />
        <g className="pe-copa">
          {FOLHAS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} style={{ ["--i" as string]: i, transformOrigin: `${x}px ${y}px` }} />
          ))}
        </g>
        <g className="pe-flores">
          {FLORES.map(([x, y], i) => (
            <g key={i} style={{ ["--i" as string]: i, transformOrigin: `${x}px ${y}px` }}>
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx={x} cy={y - 5} rx="3.2" ry="5" transform={`rotate(${a} ${x} ${y})`} />
              ))}
              <circle cx={x} cy={y} r="2.4" />
            </g>
          ))}
        </g>
        <g className="pe-frutos">
          {FRUTOS.map(([x, y], i) => (
            <g key={i} style={{ ["--i" as string]: i, transformOrigin: `${x}px ${y - 9}px` }}>
              <circle cx={x} cy={y} r="11" />
              <circle className="pe-brilho" cx={x - 4} cy={y - 4} r="3" />
              <path d={`M${x} ${y - 11} q4 -6 10 -5 q-3 5 -10 5`} />
            </g>
          ))}
        </g>
      </svg>
  );
}

// família em traço simples, no mesmo estilo da árvore: dois adultos e uma criança de mãos dadas, a criança segura uma laranja
const PESSOAS: { x: number; h: number; pele: string; roupa: string }[] = [
  { x: 92, h: 150, pele: "#c68650", roupa: "#3e7a3a" },
  { x: 150, h: 98, pele: "#e0a878", roupa: "#ffd08a" },
  { x: 208, h: 140, pele: "#8d5a3b", roupa: "#f4e6cf" },
];
function Familia() {
  const chao = 318;
  return (
    <svg className="pe-familia" viewBox="0 0 300 340" role="presentation">
      <ellipse className="pe-chao" cx="150" cy={chao} rx="120" ry="10" />
      <path className="pe-maos" d={`M110 ${chao - 72} Q122 ${chao - 58} 134 ${chao - 50} M166 ${chao - 50} Q178 ${chao - 58} 190 ${chao - 68}`} />
      {PESSOAS.map((p, i) => {
        const topo = chao - p.h, r = p.h * 0.13;
        return (
          <g key={i} style={{ ["--i" as string]: i, transformOrigin: `${p.x}px ${chao}px` }}>
            <rect x={p.x - r * 1.15} y={topo + r * 2.1} width={r * 2.3} height={p.h - r * 2.1} rx={r * 1.1} fill={p.roupa} />
            <circle cx={p.x} cy={topo + r} r={r} fill={p.pele} />
          </g>
        );
      })}
      <g className="pe-laranjinha"><circle cx="150" cy={chao - 50} r="11" /><path d={`M150 ${chao - 61} q4 -6 10 -5 q-3 5 -10 5`} /></g>
    </svg>
  );
}
