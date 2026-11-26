"use client";

// Garrafas Orange 3D (PET 300 ml e vidro) para o hero, com o seletor PET / Vidro / As duas.
// Cada garrafa faz a animação de encher e tampar na primeira vez que aparece.
// No page.tsx, importe com dynamic(() => import(...), { ssr: false }): o WebGL só existe no navegador.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { iniciarVitrine, type Modo, type Vitrine } from "@/lib/garrafa-3d";

type Props = {
  /** O que mostrar se o aparelho não tiver WebGL ou o modelo não carregar. */
  fallback?: ReactNode;
};

const OPCOES: { modo: Modo; rotulo: string; url: string }[] = [
  { modo: "pet", rotulo: "PET", url: "pet" },
  { modo: "vidro", rotulo: "Vidro", url: "vidro" },
  { modo: "ambas", rotulo: "As duas", url: "duas" },
];

function modoDaUrl(): Modo {
  const q = new URLSearchParams(location.search).get("garrafa");
  return OPCOES.find((o) => o.url === q)?.modo ?? "ambas";
}

export default function GarrafaHero({ fallback = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vitrineRef = useRef<Vitrine | null>(null);
  const [modo, setModo] = useState<Modo>("ambas");
  const [falhou, setFalhou] = useState(false);
  const [dica, setDica] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const inicial = modoDaUrl();
    setModo(inicial);
    const v = iniciarVitrine(canvas, {
      garrafas: { pet: { glb: "/garrafa-orange.glb" }, vidro: { glb: "/garrafa-vidro.glb" } },
      mostrar: inicial,
      piso: !matchMedia("(max-width: 760px)").matches,
      desvanecer: [0.84, 0.99],
      aoTerminarIntro: () => setDica(true),
      aoInteragir: () => setDica(false),
      aoMudarModo: (m) => setModo(m),
      aoErro: () => setFalhou(true),
    });
    vitrineRef.current = v;
    return () => {
      v.destruir();
      vitrineRef.current = null;
    };
  }, []);

  const escolher = (m: Modo) => {
    setModo(m);
    vitrineRef.current?.mostrar(m);
    const url = new URL(location.href);
    url.searchParams.set("garrafa", OPCOES.find((o) => o.modo === m)!.url);
    history.replaceState(null, "", url);
  };

  if (falhou) return <>{fallback}</>;

  return (
    <div className="garrafa-3d">
      <fieldset className="garrafa-escolha">
        <legend className="sr-only">Escolha a garrafa</legend>
        <div className="trilho">
          {OPCOES.map((o) => (
            <label key={o.modo}>
              <input
                type="radio"
                name="garrafa"
                value={o.url}
                checked={modo === o.modo}
                onChange={() => escolher(o.modo)}
              />
              {o.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <canvas
        ref={canvasRef}
        role="application"
        aria-roledescription="garrafa 3D interativa"
        aria-label="Garrafa de suco de laranja Orange sendo enchida e tampada. Arraste ou use as setas para girar."
        tabIndex={0}
      />
      <div className="garrafa-controles">
        <span className={dica ? "garrafa-dica" : "garrafa-dica some"} aria-hidden="true">
          {modo === "ambas" ? "Arraste uma garrafa para girar" : "Arraste para girar"}
        </span>
        <button type="button" className="garrafa-repetir" onClick={() => vitrineRef.current?.reiniciar()}>
          Ver o enchimento de novo
        </button>
      </div>
    </div>
  );
}
