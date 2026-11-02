// Tipos do módulo garrafa-3d.js (coloque ao lado do .js com o mesmo nome).
import type { WebGLRenderer, Scene, PerspectiveCamera, Vector3 } from 'three';

export type IdGarrafa = 'pet' | 'vidro';
export type Modo = 'pet' | 'vidro' | 'ambas';
/** URL do .glb, os bytes, ou uma função que devolve os bytes só quando precisar (carregamento preguiçoso). */
export type FonteGlb = string | ArrayBuffer | (() => Promise<ArrayBuffer>);

export interface OpcoesComuns {
  /** rad: amplitude do balanço parada no piso (0 = parada). Padrão 0.35 */
  balanco?: number;
  /** rad por pixel arrastado; 0 = automático. Padrão 0 */
  sensibilidade?: number;
  /** s no ar antes de voltar a pousar (0 = fica onde soltou). Padrão 2.5 */
  repouso?: number;
  /** brilho geral. Padrão 1 */
  exposicao?: number;
  /** piso espelhado (desenha a cena 2x; desligue no celular). Padrão true */
  piso?: boolean;
  /** gotas de condensação. Padrão false */
  orvalho?: boolean;
  /** aparelho fraco: cai para meia taxa de quadros (a resolução nunca cai). Padrão true */
  adaptar?: boolean;
  /** [início, fim] em fração da altura: a base do quadro some em degradê, ex. [0.84, 0.99] */
  desvanecer?: [number, number] | null;
  /** false = já começa cheia e tampada. Padrão true */
  intro?: boolean;
  /** primeiro quadro desenhado (ex.: tirar um pôster) */
  aoCarregar?: (() => void) | null;
  /** WebGL ou GLB falhou */
  aoErro?: ((erro: unknown) => void) | null;
  /** só para testes: tempo em ms */
  relogio?: (() => number) | null;
}

export interface OpcoesGarrafa extends OpcoesComuns {
  /** Padrão 'garrafa-orange.glb' */
  glb?: string | ArrayBuffer;
  /** altura do suco em pé (m); por padrão vem do GLB */
  nivel?: number;
  aoTerminarIntro?: (() => void) | null;
  aoInteragir?: (() => void) | null;
}

export interface OpcoesVitrine extends OpcoesComuns {
  garrafas: Partial<Record<IdGarrafa, { glb: FonteGlb; nivel?: number }>>;
  /** Padrão 'pet' */
  mostrar?: Modo;
  aoTerminarIntro?: ((id: IdGarrafa) => void) | null;
  aoInteragir?: ((id: IdGarrafa) => void) | null;
  aoMudarModo?: ((modo: Modo) => void) | null;
}

/** Estado do líquido (somente leitura na prática). */
export interface Liquido {
  n: Vector3;
  espuma: number;
  [chave: string]: unknown;
}

export interface Garrafa {
  /** null até o início adiado (use aoCarregar) */
  readonly renderer: WebGLRenderer | null;
  scene: Scene;
  camera: PerspectiveCamera;
  liquido: Liquido;
  /** toca o enchimento de novo */
  reiniciar(): void;
  /** pausa o balanço automático */
  pausarGiro(pausar?: boolean): void;
  readonly pausado: boolean;
  /** para o laço, tira os listeners e libera a GPU (chame ao desmontar) */
  destruir(): void;
}

export interface Vitrine {
  readonly renderer: WebGLRenderer | null;
  scene: Scene;
  camera: PerspectiveCamera;
  garrafas: Map<IdGarrafa, { liquido: Liquido }>;
  readonly modo: Modo;
  /** troca com animação; quem entra pela primeira vez faz o enchimento */
  mostrar(modo: Modo): void;
  /** enchimento de novo: de uma garrafa ou das que estão à vista */
  reiniciar(id?: IdGarrafa): void;
  pausarGiro(pausar?: boolean): void;
  readonly pausado: boolean;
  destruir(): void;
}

export function iniciarGarrafa(canvas: HTMLCanvasElement, opcoes?: OpcoesGarrafa): Garrafa;
export function iniciarVitrine(canvas: HTMLCanvasElement, opcoes: OpcoesVitrine): Vitrine;
