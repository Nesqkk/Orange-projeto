"use client";

// Card "Design com propósito": a garrafa PET do topo se monta, enche e tampa toda vez que o card aparece.
// Reaproveita o garrafa-3d.js (mesmo .glb e mesma animação do hero). Importar com dynamic(..., { ssr: false }).
import { useEffect, useRef } from "react";
import { iniciarGarrafa } from "@/lib/garrafa-3d";

export default function GarrafaMontagem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let g: ReturnType<typeof iniciarGarrafa> | null = null;
    try {
      g = iniciarGarrafa(canvas, { glb: "/garrafa-orange.glb", piso: false, balanco: 0.15, intro: true });
    } catch {
      return;
    }
    // Repete o enchimento sempre que o card volta a aparecer (carrossel ou rolagem).
    let primeira = true;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      if (primeira) { primeira = false; return; }
      g?.reiniciar();
    }, { threshold: 0.6 });
    io.observe(canvas);
    return () => { io.disconnect(); g?.destruir(); };
  }, []);

  return <canvas ref={canvasRef} className="montagem-art" aria-hidden="true" />;
}
