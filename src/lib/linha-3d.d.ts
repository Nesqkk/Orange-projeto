// Tipos do módulo linha-3d.js (copo e garrafa térmicos em 3D).
export type ProdutoLinha = 'copo' | 'garrafa';
export type CorLinha = 'preto' | 'prata' | 'osso' | 'laranja';
export interface Miniatura { nome: string; img: string }
export interface Linha3D {
  produto(p: ProdutoLinha): void;
  cor(c: CorLinha): void;
  /** Grava "Nº 0427" abaixo do logo (0 tira). */
  numero(n: number): void;
  irPara(angulo: number): void;
  /** < 1 aproxima, > 1 afasta */
  zoom(fator: number): void;
  destruir(): void;
}
export const CORES: Record<CorLinha, { nome: string; base: string }>;
export const PRODUTOS: Record<ProdutoLinha, { titulo: string; lead: string; specs: [string, string][] }>;
export function iniciarLinha(canvas: HTMLCanvasElement, opcoes?: {
  produto?: ProdutoLinha; cor?: CorLinha; numero?: number;
  aoMiniaturas?: (lista: Miniatura[]) => void; aoMudarAngulo?: (i: number) => void;
}): Linha3D;
