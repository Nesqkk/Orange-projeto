"use client";

// Copo e garrafa Orange em 3D (por enquanto só na cor preta), sobre o fundo do site,
// com uma barra para trocar de produto, mudar o ângulo e dar zoom.
// No page.tsx, importe com dynamic(() => import(...), { ssr: false }): o WebGL só existe no navegador.
import { useEffect, useRef, useState } from "react";
import { PRODUTOS, iniciarLinha, type Linha3D, type ProdutoLinha } from "@/lib/linha-3d";

export default function LinhaShowcase() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linhaRef = useRef<Linha3D | null>(null);
  const [produto, setProduto] = useState<ProdutoLinha>("copo");
  const [falhou, setFalhou] = useState(false);
  // Os números saem pela ordem de compra. Quantos já foram vendidos vem da variável NEXT_PUBLIC_FOUNDERS_VENDIDOS.
  const vendidos = Math.min(1000, Math.max(0, Number(process.env.NEXT_PUBLIC_FOUNDERS_VENDIDOS) || 0));
  const esgotado = vendidos >= 1000;
  const numero = esgotado ? 1000 : vendidos + 1;
  const numeroTexto = String(numero).padStart(4, "0");

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      linhaRef.current = iniciarLinha(canvasRef.current, { produto: "copo", cor: "preto", numero });
    } catch {
      setFalhou(true);
    }
    return () => { linhaRef.current?.destruir(); linhaRef.current = null; };
  }, []);

  if (falhou) return null;
  const P = PRODUTOS[produto]; // usado no rótulo do canvas

  return (
    <div className="linha-3d">
      <div className="linha-palco">
        <canvas ref={canvasRef} tabIndex={0} aria-label={`${P.titulo} em 3D. Arraste para girar.`} />
      </div>
      <div className="linha-produtos" role="group" aria-label="Produto">
        {(["copo", "garrafa"] as const).map((p) => (
          <button key={p} type="button" aria-pressed={produto === p} onClick={() => { setProduto(p); linhaRef.current?.produto(p); }}>
            {p === "copo" ? "Copo, 473 ml" : "Garrafa, 600 ml"}
          </button>
        ))}
      </div>
      {/* Founders Edition: o número é o protagonista. O que a pessoa digita aparece gravado no copo e na garrafa acima. */}
      <div className="founders-edicao">
        <div className="founders-numero">
          <p className="founders-algarismos" aria-live="polite"><span className="sr-only">Número </span>{numeroTexto}<span className="founders-total"> / 1000</span></p>
          {esgotado && <p className="founders-status">Os mil números já têm dono. A edição fechou.</p>}
        </div>
        <div className="founders-texto">
          <h3>Mil números. Um deles é seu.</h3>
          <p>Gravado a laser, na ordem de chegada. Quando chegar a mil, fecha.</p>
          <ul className="founders-lista">
            <li>Numerada de 0001 a 1000.</li>
            <li>Novidades chegam antes para quem é fundador.</li>
            <li>Não volta depois que fecha.</li>
          </ul>
          <a className="button button-dark founders-acao"
            href={`mailto:oi@orange.com.br?subject=${encodeURIComponent(`Founders Edition: quero garantir o número ${numeroTexto}`)}&body=${encodeURIComponent(`Oi! Quero entrar na lista de espera da Founders Edition. Quero garantir o próximo número livre (hoje, o ${numeroTexto}).`)}`}>
            {esgotado ? "Entrar na lista para a próxima edição" : `Garantir o número ${numeroTexto}`}
          </a>
        </div>
      </div>
    </div>
  );
}
