// Garrafa Orange 3D: estúdio preto, entrada enchendo o suco + tampa rosqueando, depois movimento livre.
// Vitrine: a PET aprovada, a garrafa de vidro ou as duas lado a lado, num só contexto WebGL (um estúdio, um piso).
// Uso:  import { iniciarGarrafa, iniciarVitrine } from './garrafa-3d.js';
//       iniciarGarrafa(document.querySelector('canvas'), { glb: 'garrafa-orange.glb' });
//       const v = iniciarVitrine(canvas, { garrafas: { pet: { glb: 'garrafa-orange.glb' }, vidro: { glb: 'garrafa-vidro.glb' } }, mostrar: 'pet' });
//       v.mostrar('ambas');   // 'pet' | 'vidro' | 'ambas'
// Requer three@0.169 (importmap ou bundler). O canvas é transparente: o fundo preto vem da página.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const PADRAO = {
  glb: 'garrafa-orange.glb', // iniciarGarrafa: URL do modelo ou ArrayBuffer
  nivel: 0.154,              // altura do suco com a garrafa em pé, em metros (vem do GLB, extras.nivelSuco)
  balanco: 0.35,             // rad: parada no piso, ela balança ±20° bem devagar sem perder a frente de vista (0 = parada)
  sensibilidade: 0,          // rad de giro por pixel arrastado; 0 = automático (arrastar a altura da garrafa = meia volta)
  repouso: 2.5,              // s no ar depois de soltar; aí ela volta a pousar em pé (0 = fica onde soltou)
  exposicao: 1.0,
  piso: true,                // piso preto espelhado (renderiza a cena 2x; desligue em aparelhos fracos)
  orvalho: false,            // gotas de condensação (desligado por padrão: PET seco lê mais real e mais premium)
  adaptar: true,             // se o aparelho não acompanhar, desenha em meia velocidade (a resolução nunca cai)
  desvanecer: null,          // [início, fim] em fração da altura do canvas: a base do quadro some em degradê (ex.: [0.84, 0.99]);
                             // faz o mesmo que um mask-image no CSS, mas dentro do WebGL, sem uma passada extra no compositor
  intro: true,               // false = já começa cheia e tampada
  aoTerminarIntro: null,     // callback(id) quando a garrafa fica livre para mexer
  aoInteragir: null,         // callback(id) no primeiro arrasto (por exemplo, para esconder a dica)
  aoCarregar: null,          // callback no primeiro quadro desenhado com o modelo (ex.: tirar um pôster estático)
  aoErro: null,              // callback(erro) se o WebGL ou o GLB falharem (ex.: manter o pôster); sem ele, console.error
  relogio: null,             // opcional: função que devolve o tempo em ms (testes)
  // só iniciarVitrine:
  garrafas: null,            // { pet: { glb }, vidro: { glb } }: glb = URL, ArrayBuffer ou função que devolve Promise<ArrayBuffer>
  mostrar: 'pet',            // 'pet' | 'vidro' | 'ambas'
  aoMudarModo: null,         // callback(modo) quando a troca de modo começa
};

// tempos da entrada (s)
const T = { jatoIni: 0.35, encherIni: 0.55, encherFim: 3.1, tampaIni: 3.35, tampaPouso: 3.8, tampaFim: 4.65 };
const ALVO_CAMERA = new THREE.Vector3(0, 0.082, 0);
const DIST_CAMERA = 0.78;
const POSE = -0.3;           // pose de vitrine: virada ~17° para a luz principal (duas faces e uma quina aparecem)
const NO_AR = 0.025;         // quanto a garrafa sobe quando é pega (m)
// luz principal: softbox grande e perto, à frente e à esquerda e acima (az -40°, el 40°); fica parada no estúdio.
// Alta o bastante para não refletir nas faces verticais (sem véu sobre o rótulo); aparece só no ombro e na tampa
const CHAVE_DIST = 0.28;
const CHAVE_POS = new THREE.Vector3(-Math.sin(0.70) * Math.cos(0.70), Math.sin(0.70), Math.cos(0.70) * Math.cos(0.70))
  .multiplyScalar(CHAVE_DIST).add(new THREE.Vector3(0, 0.0935, 0));
const RAIO_QUINA = 0.037;    // do eixo até a quina mais afastada do corpo (m): evita atravessar o piso
const EIXO_Y = new THREE.Vector3(0, 1, 0);
// vitrine
const ALTURA_PET = 0.187;    // altura da PET (m): o quadro do vidro é o da PET em escala, para as duas parecerem do mesmo tamanho
const VAO = 0.035;           // entre os corpos, no modo 'ambas'
const FRENTE = 0.08;         // no modo 'ambas', a garrafa pega vem para a frente: gira solta sem esbarrar na vizinha
const TROCA = 0.9;           // s da troca de modo
const ATRASO_VIDRO = 0.35;   // s: nas duas juntas, o vidro começa a encher depois da PET
// sobra de cada lado no quadro da PET, na tela mais estreita antes de a câmera recuar (0,62)
const MARGEM = 0.62 * DIST_CAMERA * Math.tan(THREE.MathUtils.degToRad(17 / 2)) - RAIO_QUINA;
const MODOS = { pet: ['pet'], vidro: ['vidro'], ambas: ['pet', 'vidro'] };

// ---------- tipos de garrafa: o que muda de uma para outra
// Cada tipo diz como montar os materiais, como a tampa entra e as medidas que o motor usa. Ganchos opcionais:
//   montar(g, malhas, ctx)          materiais das peças do GLB; devolve o pivô da tampa (Group filho de g.garrafa)
//   tampa(g, t)                     posição e giro da tampa na entrada (t em s desde o início da entrada)
//   atualizar(g, dt, t, agora)      a cada quadro desenhado, depois do suco (matrizes do mundo já atualizadas)
//   quieto(g)                       false enquanto algo próprio do tipo se mexe (ex.: a alça balançando): impede o
//                                   ritmo calmo de 30 quadros/s e o pulo de quadros iguais
//   programas(g)                    objetos fora de g.raiz que também precisam ser compilados antes de aparecer
//   descartar(g)                    libera o que o tipo criou fora da cena
// ctx = { renderer, scene, camera, cfg, U: g.U }. g traz: id, tipo, raiz (pivô no centro), garrafa (origem na base),
// tampa, extras (do GLB), materiaisGlb (nome -> material original do GLB, antes da troca), U (uniforms dos shaders da
// garrafa), st (movimento), liq (suco), altura, centro, nivel, t (s desde o início da entrada).
const TIPOS = {
  pet: {
    raiz: 'Garrafa_Orange_300ml',
    rotulo: 'Garrafa PET de suco de laranja Orange. Arraste em qualquer direção ou use as setas para girar; Home devolve a garrafa ao lugar.',
    T, pose: POSE, defasagem: 0, freqBalanco: 0.08,
    altura: ALTURA_PET,
    esticaSombra: 1.9,
    medidas(g) {
      g.raioQuina = RAIO_QUINA;              // quina do corpo
      g.meiaLargura = 0.032;                 // meia largura do corpo de frente (enquadramento)
      g.centroSuco = new THREE.Vector3(0, 0.075, 0);
      g.bocaY = g.altura - 0.0015;
      g.escalaSombra = 1;
    },
    montar(g, malhas, { renderer, cfg, U }) {
      const tinta = malhas['Impressao_preta'][0];
      tinta.material.depthWrite = false;
      tinta.material.roughness = 0.45;                // tinta fosca sobre o PET: o filete de luz continua por cima, mais largo e fraco
      tinta.material.color.setScalar(0.75);           // #111 da textura -> ~#0D0D0D
      tinta.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tinta.renderOrder = 2;

      // PET: camada de reflexo (só os filetes de luz; funciona sobre o canvas transparente) + camada de borda
      // (as laterais vistas de raspão escurecem, como no vidro de verdade). O corpo recebe as gotas; o gargalo não.
      for (const pet of [...(malhas['PET_corpo'] ?? []), ...(malhas['PET_gargalo'] ?? [])]) {
        const gotas = cfg.orvalho && pet.geometry.attributes.uv ? pet.material.normalMap : null;  // mapa de gotas vem no GLB
        const gargalo = pet.material.name === 'PET_gargalo';
        pet.material = materialReflexoPET(U, gotas);
        pet.renderOrder = 1;
        const b = new THREE.Mesh(pet.geometry, materialBordaPET(U, gotas, gargalo)); b.renderOrder = 1; pet.add(b);
      }

      const pp = malhas['Tampa_preta_PP'][0];
      // PP preto injetado: acetinado, sem verniz (o serrilhado pega a luz principal em linhas finas)
      pp.material = new THREE.MeshStandardMaterial({ name: 'Tampa_preta_PP', color: new THREE.Color('#121212'), roughness: 0.38,
        metalness: 0, side: THREE.DoubleSide });
      // tampa ganha um pivô próprio no eixo da garrafa para descer rosqueando
      const tampa = new THREE.Group(); g.garrafa.add(tampa);
      tampa.attach(pp);
      return tampa;
    },
    tampa(g, t) {
      // rosca de 3 entradas (38 mm, passo 9 mm): 3/4 de volta assenta a tampa, descendo 6,75 mm presa à rosca
      const tTampa = clamp01((t - T.tampaIni) / (T.tampaPouso - T.tampaIni));
      const tRosca = clamp01((t - T.tampaPouso) / (T.tampaFim - T.tampaPouso));
      const giro = 0.75 * (tRosca < 0.8 ? easeInOut(tRosca / 0.8) * 0.94 : 0.94 + 0.06 * easeOut((tRosca - 0.8) / 0.2));  // aperto final curto
      g.tampa.position.y = 0.11 * (1 - easeOut(tTampa)) + 0.009 * (0.75 - giro);
      g.tampa.rotation.y = -2 * Math.PI * giro;
      g.tampa.visible = t > T.tampaIni - 0.05;
    },
  },

  // Vidro sodo-cálcico grosso: medidas e peças vêm do GLB (extras na raiz 'Garrafa_Orange_Vidro'). Duas camadas como
  // na PET (reflexo + borda da parede grossa vista de raspão, com o verde do vidro), o suco ampliado pela parede cheia,
  // tampa de inox escovado e alça de tecido (corrente de verlet presa no rebite). Tudo nos ganchos; o motor não muda.
  vidro: {
    raiz: 'Garrafa_Orange_Vidro',
    rotulo: 'Garrafa de vidro de suco de laranja Orange, com tampa de inox. Arraste em qualquer direção ou use as setas para girar; Home devolve a garrafa ao lugar.',
    T: { jatoIni: 0.35, encherIni: 0.55, encherFim: 3.4, tampaIni: 3.65, tampaPouso: 4.1, tampaFim: 5.3 },
    pose: POSE, defasagem: 2.2, freqBalanco: 0.071,   // fase e ritmo próprios: as duas não balançam juntas
    altura: 0.228,
    esticaSombra: 2.2,
    medidas(g) {
      const x = g.extras;
      g.raioQuina = x.raioBase ?? 0.0325;    // corpo redondo: o raio da base é o da quina
      g.meiaLargura = g.raioQuina;
      g.centroSuco = new THREE.Vector3(0, g.nivel * 0.5, 0);
      g.bocaY = x.bocaY ?? g.altura - 0.02;
      g.escalaSombra = g.raioQuina / RAIO_QUINA;
      g.rosca = { descida: x.tampa?.descida ?? 0.0045, voltas: x.tampa?.voltas ?? 1.25 };
    },
    montar(g, malhas, { renderer, U }) {
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const tinta = malhas['Impressao_preta']?.[0];
      if (tinta) {
        // tinta preta fosca sobre o vidro, como na PET
        tinta.material.depthWrite = false;
        tinta.material.roughness = 0.45;
        tinta.material.color.setScalar(0.75);
        if (tinta.material.map) tinta.material.map.anisotropy = maxAniso;
        tinta.renderOrder = 2;
      }
      // vidro: reflexo (alfa = brilho, como a PET) + borda (parede grossa de raspão, verde nas partes grossas, base-lente)
      g.uVidro = { uComSuco: { value: 0 } };
      const reflexo = materialReflexoVidro(U), borda = materialBordaVidro(U, g.uVidro.uComSuco);
      for (const v of malhas['Vidro'] ?? []) {
        v.material = reflexo;
        v.renderOrder = 1;
        const b = new THREE.Mesh(v.geometry, borda); b.renderOrder = 1; v.add(b);
      }
      // suco atrás da parede cheia: a parede é uma lente cilíndrica e o suco aparece quase até a face de fora
      lenteNoSuco(malhas['Suco_laranja'][0].material);

      // inox escovado: a textura de rugosidade e a direção da escova vêm do GLB (risco vertical, u = volta, v = altura)
      const glb = g.materiaisGlb['Inox_escovado'];
      const inox = new THREE.MeshPhysicalMaterial({ name: 'Inox_escovado', color: new THREE.Color('#d2d4d6'), metalness: 1,
        roughness: 0.62, roughnessMap: glb?.roughnessMap ?? null, anisotropy: 0.85,
        anisotropyRotation: glb?.anisotropyRotation ?? Math.PI / 2, envMapIntensity: 1.35 });
      if (inox.roughnessMap) inox.roughnessMap.anisotropy = maxAniso;
      // o estúdio é preto dos lados: o inox só refletiria preto. Como numa foto de produto, cartões altos dos lados
      // (só para a tampa: o vidro e a PET continuam no estúdio de sempre)
      inox.envMap = g.ambienteInox = ambienteInox(renderer);
      inox.onBeforeCompile = (sh) => {
        sh.uniforms.uBottleInv = U.uBottleInv;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform mat4 uBottleInv;')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            // topo um pouco mais escuro (escova em círculo, reflete o teto do estúdio de lado)
            float nTopo = (mat3(uBottleInv) * inverseTransformDirection(normal, viewMatrix)).y;
            diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.6, 0.95, nTopo);`);
      };
      const pecas = {
        Inox_escovado: inox,
        Vedacao: new THREE.MeshStandardMaterial({ name: 'Vedacao', color: new THREE.Color('#0d0d0d'), metalness: 0, roughness: 0.62 }),
        Rebite: new THREE.MeshStandardMaterial({ name: 'Rebite', color: new THREE.Color('#151515'), metalness: 0.6, roughness: 0.32 }),
      };
      // tampa, vedação e rebite vêm fechados no GLB e descem juntos num pivô no eixo
      const tampa = new THREE.Group(); g.garrafa.add(tampa);
      for (const [nome, m] of Object.entries(pecas)) for (const o of malhas[nome] ?? []) { o.material = m; tampa.attach(o); }
      // alça: filha da tampa (desce e gira com ela); simulada no mundo em atualizar()
      g.alca = criarAlca(g, tampa, maxAniso);
      g.alca.malha.material.envMap = g.ambienteInox;   // a alça também recebe a luz dos cartões (tecido claro)
      tampa.add(g.alca.malha);
      return tampa;
    },
    tampa(g, t) {
      // desce reta e rosqueia `voltas` voltas, descendo `descida` presa à rosca; aperto final curto
      const T = this.T;
      const tTampa = clamp01((t - T.tampaIni) / (T.tampaPouso - T.tampaIni));
      const tRosca = clamp01((t - T.tampaPouso) / (T.tampaFim - T.tampaPouso));
      const giro = tRosca < 0.85 ? easeInOut(tRosca / 0.85) * 0.95 : 0.95 + 0.05 * easeOut((tRosca - 0.85) / 0.15);
      g.tampa.position.y = 0.11 * (1 - easeOut(tTampa)) + g.rosca.descida * (1 - giro);
      g.tampa.rotation.y = -2 * Math.PI * g.rosca.voltas * giro;
      g.tampa.visible = t > T.tampaIni - 0.05;
    },
    atualizar(g, dt) {
      g.uVidro.uComSuco.value = clamp01((g.nivelEmPe - 0.0075) / 0.004);   // a base só reflete laranja com suco em cima
      g.alca.passo(dt);
    },
    quieto(g) { return g.alca.quieta; },   // a alça ainda balançando mantém o ritmo cheio
    programas(g) { return []; },            // a alça é filha da tampa: já entra na compilação de g.raiz
    descartar(g) { g.alca?.descartar(); g.ambienteInox?.dispose(); },
  },
};

// Uma garrafa só (PET), como sempre foi: é a vitrine com a PET.
export function iniciarGarrafa(canvas, opcoes = {}) {
  const { glb = PADRAO.glb, nivel, ...resto } = opcoes;
  const v = iniciarVitrine(canvas, { ...resto, garrafas: { pet: { glb, nivel } }, mostrar: 'pet', aoMudarModo: null });
  return {
    get renderer() { return v.renderer; }, scene: v.scene, camera: v.camera, liquido: v.garrafas.get('pet').liquido,
    reiniciar() { v.reiniciar(); },
    pausarGiro(x = true) { v.pausarGiro(x); },
    get pausado() { return v.pausado; },
    destruir() { v.destruir(); },
  };
}

export function iniciarVitrine(canvas, opcoes = {}) {
  const cfg = { ...PADRAO, ...opcoes };
  const agoraMs = () => (cfg.relogio ? cfg.relogio() : performance.now());
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduzir) cfg.intro = false;
  const falhar = (e) => (cfg.aoErro ? cfg.aoErro(e) : console.error(e));
  const ac = new AbortController(), sinal = { signal: ac.signal };   // destruir() remove todos os listeners de uma vez
  let destruido = false;

  // ---------- estado compartilhado com os shaders (o tempo, a luz e o ruído são os mesmos para todas as garrafas)
  const uTempo = { value: 0 }, uRuido = { value: null }, uChaveP = { value: CHAVE_POS }, uChaveD = { value: CHAVE_DIST };

  // ---------- garrafas pedidas, sempre na mesma ordem (no modo 'ambas' a PET fica à esquerda)
  const G = {}, lista = [];
  const pedidas = cfg.garrafas ?? { pet: { glb: cfg.glb } };
  for (const id of ['pet', 'vidro']) {
    const op = pedidas[id];
    if (!op) continue;
    const g = novaGarrafa(id, op);
    G[id] = g; lista.push(g);
  }
  const pode = (m) => MODOS[m] && MODOS[m].every((id) => G[id]);
  let modo = pode(cfg.mostrar) ? cfg.mostrar : (lista[0]?.id ?? 'pet');

  function novaGarrafa(id, op) {
    const tipo = TIPOS[id];
    return {
      id, tipo, op, fonte: op.glb ?? (id === 'pet' ? PADRAO.glb : 'garrafa-vidro.glb'), rotulo: op.rotulo ?? tipo.rotulo,
      U: {
        uN: { value: new THREE.Vector3(0, 1, 0) }, uP0: { value: new THREE.Vector3(0, -1, 0) },
        uT1: { value: new THREE.Vector3(1, 0, 0) }, uT2: { value: new THREE.Vector3(0, 0, 1) },
        uSpin: { value: 0 }, uRipple: { value: 0 }, uTime: uTempo, uFoam: { value: 0 },
        uBottleInv: { value: new THREE.Matrix4() }, uOrvalho: { value: 0 }, uNivelGotas: { value: PADRAO.nivel },
        uNLoc: { value: new THREE.Vector3(0, 1, 0) }, uP0Loc: { value: new THREE.Vector3() },
        uPerfil: { value: Array.from({ length: 48 }, () => new THREE.Vector2(0.03, 5)) }, uPerfilY: { value: new THREE.Vector2(0, 0.18) },
        uChaveP, uChaveD, uRuido,
      },
      // movimento livre: orientação e velocidade angular (rad/s, no mundo), altura no ar e avanço para a frente
      st: {
        q: new THREE.Quaternion(), w: new THREE.Vector3(),
        alt: 0, altVel: 0, frente: 0, frenteVel: 0, noAr: false, pousando: false, fase: 0,
        arrastando: false, pendente: null, ultimoX: 0, ultimoY: 0, ultimoMov: 0,
        ultimaInteracao: -1e9, interativa: false, avisou: false,
      },
      liq: {
        n: new THREE.Vector3(0, 1, 0), nv: new THREE.Vector3(), pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        spin: 0, ripple: 0, prim: true, wyAnt: 0, energia: 0, espuma: 0,
      },
      pose: { uy: 1, lado: 0, baixo: 0 },
      altura: tipo.altura, centro: tipo.altura / 2, nivel: PADRAO.nivel, sens: 0.006, meiaLarguraAgora: 0.05,
      raiz: null, garrafa: null, tampa: null, sombra: null, jato: null, volume: null, caixa: null, extras: {},
      bytes: null, preparo: null, pronta: false, acordar: null,
      ativa: false, saindo: false, entrou: false, inicio: 0, x: 0, xIni: 0, xFim: 0,
      t: 0, nivelEmPe: 0, agitacao: 0, jatoAtivo: false,
    };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(17, 1, 0.01, 5);   // lente longa (~120 mm): perspectiva de foto de produto
  let renderer = null, pmrem = null, piso = null, pisoSimples = null, pisoDuplo = null, desvanecer = null;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let avisarCarregou = false, pronto = false, sujo = true;

  // ---------- carga: bytes já (rede, não pesa), o resto quando o navegador estiver ocioso (a página pinta antes)
  const ocioso = (fn, ms = 200) => (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(fn, { timeout: ms }) : requestAnimationFrame(() => setTimeout(fn, 0)));
  function obterBytes(g) {
    if (!g.bytes) {
      const f = g.fonte;
      g.base = typeof f === 'string' ? THREE.LoaderUtils.extractUrlBase(f) : '';
      g.bytes = f instanceof ArrayBuffer ? Promise.resolve(f)
        : typeof f === 'function' ? Promise.resolve().then(f)
        : fetch(f, { signal: ac.signal, ...(g.urgente === false ? { priority: 'low' } : {}) })
          .then((r) => { if (!r.ok) throw new Error(`GLB ${f}: HTTP ${r.status}`); return r.arrayBuffer(); });
      g.bytes.catch(() => {});   // o erro é tratado por quem esperar os bytes
    }
    return g.bytes;
  }
  for (const id of MODOS[modo]) if (G[id]) obterBytes(G[id]);

  // monta e compila a garrafa; devagar = em segundo plano, um passo por vez no tempo ocioso
  function preparar(g, devagar = false) {
    if (!devagar) g.acordar?.();
    return (g.preparo ??= (async () => {
      const passo = () => (devagar && !g.urgente ? new Promise((ok) => { g.acordar = ok; ocioso(ok, 1500); }) : null);
      const bytes = await obterBytes(g);
      await passo();
      if (destruido) return;
      if (!g.raiz) criarPecas(g);
      const gltf = await new Promise((ok, erro) => loader.parse(bytes, g.base, ok, erro));
      if (destruido) return;
      await passo();
      montar(g, gltf);
      await passo();
      await compilar(g);
      g.pronta = true;
    })().catch((e) => { g.preparo = null; g.bytes = null; throw e; }));
  }
  function criarPecas(g) {
    // hierarquia: raiz (centro da garrafa; posição e orientação livres) > garrafa (origem na base)
    g.raiz = new THREE.Group(); g.raiz.visible = false;
    scene.add(g.raiz);
    g.sombra = sombraDeContato(); g.sombra.visible = false; scene.add(g.sombra);
    g.jato = criarJato(g.U); g.jato.visible = false; scene.add(g.jato);
  }
  function montar(g, gltf) {
    const garrafa = g.garrafa = gltf.scene;
    const extras = g.extras = garrafa.getObjectByName(g.tipo.raiz)?.userData ?? {};
    const box = new THREE.Box3().setFromObject(garrafa);
    g.caixa = box.clone();                      // no espaço da garrafa (origem na base): teste de toque e foco
    g.altura = box.max.y - box.min.y;
    g.centro = (box.max.y + box.min.y) / 2;
    g.nivel = g.op.nivel || extras.nivelSuco || (g.id === 'pet' ? PADRAO.nivel : g.altura * 0.75);
    g.U.uNivelGotas.value = g.nivel;
    garrafa.position.y = -g.centro;
    g.raiz.add(garrafa);
    g.tipo.medidas(g);

    const malhas = {};
    garrafa.traverse((o) => { if (o.isMesh) (malhas[o.material.name] ??= []).push(o); });
    // materiais como vieram do GLB (texturas, anisotropia, ior...): os ganchos do tipo podem aproveitar o que quiserem
    g.materiaisGlb = Object.fromEntries(Object.entries(malhas).map(([nome, ms]) => [nome, ms[0].material]));
    const suco = malhas['Suco_laranja'][0];
    suco.material = materialLiquido(g.U);
    // volume interno: o GLB traz o perfil; sem ele, um cilindro do tamanho da malha do suco
    let perfil = extras.perfilSuco;
    if (!perfil) {
      const b = new THREE.Box3().setFromObject(suco), r = (b.max.x - b.min.x) / 2;
      perfil = [[0, b.min.y, 2], [r, b.min.y, 2], [r, b.max.y, 2], [0, b.max.y, 2]];
    }
    g.volume = criarVolume(perfil);
    g.volume.amostrarPerfil(g.U.uPerfil.value, g.U.uPerfilY.value);
    g.tampa = g.tipo.montar(g, malhas, { renderer, scene, camera, cfg, U: g.U });
    redimensionar();
  }
  // shaders compilados e texturas na GPU antes de a garrafa aparecer: sem engasgo quando o jato e a tampa surgem.
  // O reflexo desenha a garrafa num alvo linear, sem tone mapping: são outras variantes dos mesmos shaders
  async function compilar(g) {
    try {
      const objs = [g.raiz, g.jato, g.sombra, ...(g.tipo.programas?.(g) ?? [])];
      for (const r of objs) r.traverse((o) => { for (const m of [].concat(o.material || [])) for (const t of [m.map, m.normalMap]) if (t) renderer.initTexture(t); });
      if (piso) {
        renderer.setRenderTarget(piso.getRenderTarget());
        for (const o of objs) renderer.compile(o, camera, scene);
        renderer.setRenderTarget(null);
      }
      await Promise.all(objs.map((o) => renderer.compileAsync(o, camera, scene)));
    } catch (e) { renderer.setRenderTarget(null); }   // sem compileAsync: compila no primeiro quadro, como antes
  }

  // ---------- câmera (orbita de leve seguindo o mouse: paralaxe). O quadro (alvo, distância e a proporção de tela
  // abaixo da qual ela recua) é o de cada modo; na troca, passa de um para o outro junto com as garrafas
  const cam = { az: 0, el: 0, alvoAz: 0, alvoEl: 0, k: 1, kBase: 1, kDin: 1 };
  const quadro = { alvo: ALVO_CAMERA.clone(), dist: DIST_CAMERA, razao: 0.62 };
  const alvoCam = new THREE.Vector3();
  let subida = 0, recuo = 0, largura = 0, altura = 0;
  function posicionarCamera(sobe) {
    // recuo: nas duas juntas, a câmera se afasta o tanto que a garrafa pega vem para a frente (ela não cresce nem sai
    // do quadro; a vizinha fica um pouco menor, o que lê como profundidade). Com uma garrafa só, é sempre 0
    const dist = quadro.dist * cam.k + recuo, elev = 0.11 + cam.el;
    alvoCam.copy(quadro.alvo); alvoCam.y += sobe * 0.5;
    camera.position.set(alvoCam.x + Math.sin(cam.az) * Math.cos(elev) * dist, alvoCam.y + Math.sin(elev) * dist, alvoCam.z + Math.cos(cam.az) * Math.cos(elev) * dist);
    camera.lookAt(alvoCam);
  }
  const tanMeia = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function quadroDe(m, q) {
    q.alvo.copy(ALVO_CAMERA); q.dist = DIST_CAMERA; q.razao = 0.62;
    if (m === 'pet') return q;
    if (m === 'vidro') {   // o quadro da PET em escala: o vidro fica do mesmo tamanho na tela
      const s = G.vidro.altura / ALTURA_PET;
      q.alvo.multiplyScalar(s); q.dist *= s;
      return q;
    }
    // as duas: altura da maior, largura das duas com a mesma sobra de cada lado
    const s = Math.max(G.pet.altura, G.vidro.altura) / ALTURA_PET;
    q.alvo.multiplyScalar(s); q.dist *= s;
    const xs = posicoesAmbas();
    q.razao = (Math.max(G.pet.raioQuina - xs.pet, xs.vidro + G.vidro.raioQuina) + MARGEM * s) / (q.dist * tanMeia());
    return q;
  }
  const xsAmbas = { pet: 0, vidro: 0 };
  function posicoesAmbas() {   // PET à esquerda, vidro à direita, VAO entre os corpos, o par centrado
    const rP = G.pet.raioQuina, rV = G.vidro.raioQuina, D = rP + rV + VAO;
    xsAmbas.pet = -(D - rP + rV) / 2; xsAmbas.vidro = (D + rP - rV) / 2;
    return xsAmbas;
  }
  const xDe = (m, g) => (m === 'ambas' ? posicoesAmbas()[g.id] : 0);
  function xFora(g, q) {   // fora do quadro q, do lado da garrafa (PET pela esquerda, vidro pela direita)
    const meia = q.dist * Math.max(1, q.razao / camera.aspect) * tanMeia() * camera.aspect;
    return (g.id === 'pet' ? -1 : 1) * (meia * 1.1 + g.raioQuina + 0.02);
  }
  function enquadrar() {   // recuo para tela estreita e sensibilidade do arrasto, para o quadro atual
    cam.kBase = Math.max(1, quadro.razao / camera.aspect);  // tela estreita: afasta a câmera
    cam.k = cam.kBase * cam.kDin;
    // arrastar a altura da garrafa na tela = meia volta
    for (const g of lista) {
      const alturaNaTela = altura * g.altura / (2 * quadro.dist * cam.kBase * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      g.sens = cfg.sensibilidade || Math.PI / Math.max(alturaNaTela, 120);
    }
  }
  function redimensionar() {
    if (!renderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // sempre a resolução máxima (até 2x)
    renderer.setSize(w, h, false);
    largura = w; altura = h;
    sujo = true;   // trocar o tamanho do buffer apaga o canvas
    camera.aspect = w / h;
    enquadrar();
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const rw = Math.round(w * pr * 0.5), rh = Math.round(h * pr * 0.5);
    if (piso) { piso.getRenderTarget().setSize(rw, rh); piso.material.uniforms.uTexel.value.set(1 / rw, 1 / rh); }
    posicionarCamera(subida);
    focosSujos = true;
  }

  // ---------- troca de modo: as garrafas deslizam de lado (a que sai passa da borda do quadro e some; a que entra
  // pela primeira vez enche quando chega) e a câmera vai junto, ~0,9 s
  const troca = { ativa: false, ini: 0, dur: 0, de: { alvo: new THREE.Vector3(), dist: 0, razao: 0 }, para: { alvo: new THREE.Vector3(), dist: 0, razao: 0 }, fim: null };
  let pedido = modo, prontoPromessa = null;
  function mostrar(novo) {
    if (!pode(novo)) { console.warn(`garrafa-3d: modo '${novo}' indisponível`); return Promise.resolve(modo); }
    pedido = novo;
    if (!pronto) { modo = novo; for (const id of MODOS[novo]) obterBytes(G[id]); return (prontoPromessa ?? Promise.resolve()).then(() => modo); }
    if (novo === modo) {   // já é este (ou a troca já vai para ele)
      if (!troca.ativa) return Promise.resolve(modo);
      return new Promise((ok) => { const f = troca.fim; troca.fim = (m) => { f?.(m); ok(m); }; });
    }
    for (const id of MODOS[novo]) G[id].urgente = true;
    return Promise.all(MODOS[novo].map((id) => preparar(G[id]))).then(() => {
      if (destruido || pedido !== novo) return modo;
      return trocar(novo);
    }, (e) => { if (!destruido) falhar(e); return modo; });
  }
  function trocar(novo) {
    const agora = agoraMs();
    zerar();
    modo = novo;
    troca.fim?.(novo);
    troca.de.alvo.copy(quadro.alvo); troca.de.dist = quadro.dist; troca.de.razao = quadro.razao;
    quadroDe(novo, troca.para);
    for (const g of lista) {
      if (MODOS[novo].includes(g.id)) {
        if (!g.ativa || g.saindo) {
          if (!g.ativa) {   // entra: começa fora do quadro atual, em pé, na pose de vitrine
            g.x = xFora(g, quadro);
            repousar(g);
            if (!g.entrou) { g.inicio = agora + (reduzir ? 0 : TROCA * 1000); if (!cfg.intro) g.inicio -= g.tipo.T.tampaFim * 1000 + 4000; }
            g.entrou = true;
            exibir(g, true);
          }
          g.saindo = false;
        }
        g.xFim = xDe(novo, g);
      } else if (g.ativa) { g.saindo = true; g.xFim = xFora(g, troca.para); }
      g.xIni = g.x;
    }
    Object.assign(troca, { ativa: true, ini: agora, dur: reduzir ? 0 : TROCA * 1000 });
    if (piso) atualizarPiso();
    if (novo === 'ambas') criarFocos(); else removerFocos();
    canvas.style.cursor = 'grab';
    sujo = true;
    cfg.aoMudarModo?.(novo);
    return new Promise((ok) => { troca.fim = ok; });
  }
  function passoTroca(agora) {
    if (!troca.ativa) return false;
    const p = troca.dur > 0 ? clamp01((agora - troca.ini) / troca.dur) : 1, e = easeInOut(p);
    for (const g of lista) if (g.ativa) g.x = THREE.MathUtils.lerp(g.xIni, g.xFim, e);
    quadro.alvo.lerpVectors(troca.de.alvo, troca.para.alvo, e);
    quadro.dist = THREE.MathUtils.lerp(troca.de.dist, troca.para.dist, e);
    quadro.razao = THREE.MathUtils.lerp(troca.de.razao, troca.para.razao, e);
    if (p >= 1) {
      troca.ativa = false;
      quadro.alvo.copy(troca.para.alvo); quadro.dist = troca.para.dist; quadro.razao = troca.para.razao;
      for (const g of lista) {
        if (g.saindo) { g.saindo = false; exibir(g, false); }   // saiu do quadro: fora da simulação e do desenho
        else if (g.ativa) g.x = g.xFim;
      }
      if (piso) atualizarPiso();
      focosSujos = true;
      const fim = troca.fim; troca.fim = null; fim?.(modo);
    }
    enquadrar();
    return true;
  }
  function exibir(g, sim) {
    g.ativa = sim;
    g.raiz.visible = g.sombra.visible = sim;
    if (!sim) { g.jato.visible = false; repousar(g); }
  }
  function repousar(g) {   // em pé na pose de vitrine, parada no piso; o suco recomeça sem herdar o salto de posição
    const st = g.st;
    st.q.setFromAxisAngle(EIXO_Y, g.tipo.pose); st.w.set(0, 0, 0);
    Object.assign(st, { alt: 0, altVel: 0, frente: 0, frenteVel: 0, noAr: false, pousando: false, arrastando: false, pendente: null, fase: 0, ultimaInteracao: -1e9 });
    g.liq.prim = true;
  }

  // ---------- movimento livre: arrastar gira em qualquer direção (com inércia); pegar levanta a garrafa do piso,
  // soltar deixa girar no ar e, parada, ela volta a pousar em pé e à pose de vitrine. Teclado faz o mesmo.
  // No toque, o gesto só vira giro depois de 8 px na horizontal: arrastar na vertical continua rolando a página.
  // Nas duas juntas, o toque pega a garrafa sob o dedo (caixa dela projetada na tela); cada uma tem o próprio estado.
  let pausado = false, agarrada = null;
  canvas.style.cursor = 'grab';
  canvas.style.touchAction = 'pan-y pinch-zoom';   // o navegador cuida da rolagem vertical e da pinça; o resto chega aqui
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  const tabOriginal = canvas.tabIndex;
  const pegar = (g) => { g.st.noAr = true; g.st.pousando = false; g.st.ultimaInteracao = agoraMs(); };
  const comecar = (e) => {
    const g = agarrada, st = g.st;
    st.pendente = null; st.arrastando = true; st.ultimoX = e.clientX; st.ultimoY = e.clientY; st.ultimoMov = agoraMs();
    pegar(g);
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    canvas.style.cursor = 'grabbing';
    document.documentElement.style.userSelect = 'none';
    if (!st.avisou) { st.avisou = true; cfg.aoInteragir?.(g.id); }
  };
  const soltar = () => {
    const st = agarrada?.st;
    if (!st) return;
    st.pendente = null;
    if (!st.arrastando) return;
    st.arrastando = false; canvas.style.cursor = 'grab'; st.ultimaInteracao = agoraMs();
    document.documentElement.style.userSelect = '';
    // soltou com o dedo parado (ou movimento reduzido): sem inércia
    if (reduzir || agoraMs() - st.ultimoMov > 40) st.w.set(0, 0, 0);
  };
  // garrafa sob o ponteiro: com uma só à vista, qualquer ponto do canvas; nas duas, a caixa projetada de cada uma
  const ret = { x0: 0, y0: 0, x1: 0, y1: 0 }, canto = new THREE.Vector3();
  function retangulo(g) {   // caixa da garrafa projetada na tela, em px CSS do canvas
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const b = g.caixa;
    for (let i = 0; i < 8; i++) {
      canto.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(g.garrafa.matrixWorld).project(camera);
      x0 = Math.min(x0, canto.x); x1 = Math.max(x1, canto.x); y0 = Math.min(y0, canto.y); y1 = Math.max(y1, canto.y);
    }
    ret.x0 = (x0 + 1) * 0.5 * largura; ret.x1 = (x1 + 1) * 0.5 * largura;
    ret.y0 = (1 - y1) * 0.5 * altura; ret.y1 = (1 - y0) * 0.5 * altura;
    return ret;
  }
  function escolher(cx, cy) {
    if (troca.ativa || !pronto) return null;
    if (modo !== 'ambas') return G[modo]?.ativa ? G[modo] : null;
    const px = cx - r.left, py = cy - r.top;
    let melhor = null, dMelhor = Infinity;
    for (const g of lista) {
      if (!g.ativa) continue;
      const q = retangulo(g), folga = 12;
      if (px < q.x0 - folga || px > q.x1 + folga || py < q.y0 - folga || py > q.y1 + folga) continue;
      const d = Math.abs(px - (q.x0 + q.x1) / 2);
      if (d < dMelhor) { dMelhor = d; melhor = g; }
    }
    return melhor;
  }
  // ponteiros na tela, por id: um segundo dedo é pinça da página, não giro
  const ativos = new Set();
  canvas.addEventListener('pointerdown', (e) => {
    ativos.add(e.pointerId);
    try { canvas.setPointerCapture(e.pointerId); } catch {}   // o pointerup sempre volta para o canvas
    if (ativos.size > 1) { soltar(); return; }
    if (e.button > 0) return;
    const g = escolher(e.clientX, e.clientY);
    if (!g?.st.interativa) return;
    agarrada = g;
    if (e.pointerType === 'mouse') comecar(e);
    else g.st.pendente = { x: e.clientX, y: e.clientY };
  }, sinal);
  const fim = (e) => { ativos.delete(e.pointerId); soltar(); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, fim, sinal);
  const zerar = () => { ativos.clear(); soltar(); };
  canvas.addEventListener('contextmenu', zerar, sinal);
  addEventListener('blur', zerar, sinal);
  // iOS: enquanto gira, o dedo não rola a página (o pan-y sozinho não basta no WebKit)
  canvas.addEventListener('touchmove', (e) => { if (agarrada?.st.arrastando) e.preventDefault(); }, { passive: false, ...sinal });
  // posição do canvas guardada fora do pointermove (sem ler layout a cada movimento)
  let r = canvas.getBoundingClientRect();
  const medir = () => { r = canvas.getBoundingClientRect(); };
  addEventListener('scroll', medir, { passive: true, ...sinal });
  const eixo = new THREE.Vector3(), dq = new THREE.Quaternion(), wInst = new THREE.Vector3();
  let sobre = true;
  addEventListener('pointermove', (e) => {
    const g = agarrada, st = g?.st, arrastando = !!st?.arrastando;
    if (r.width > 0 && r.height > 0 && !reduzir && e.pointerType === 'mouse' && !arrastando) {
      const hx = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1.5, 1.5);
      const hy = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1.5, 1.5);
      cam.alvoAz = -hx * 0.05; cam.alvoEl = hy * 0.02;
      // nas duas: a mão aberta só sobre uma garrafa
      if (modo === 'ambas' && e.target === canvas) {
        const s = !!escolher(e.clientX, e.clientY);
        if (s !== sobre) { sobre = s; canvas.style.cursor = s ? 'grab' : ''; }
      } else if (!sobre) { sobre = true; canvas.style.cursor = 'grab'; }
    }
    if (!st) return;
    if (arrastando && e.pointerType === 'mouse' && e.buttons === 0) { zerar(); return; }   // soltou fora sem pointerup
    if (st.pendente) {
      const ddx = e.clientX - st.pendente.x, ddy = e.clientY - st.pendente.y;
      if (Math.hypot(ddx, ddy) < 8) return;
      if (Math.abs(ddy) > Math.abs(ddx)) { st.pendente = null; return; }   // vertical: é rolagem
      comecar(e);
      return;
    }
    if (!st.interativa || !st.arrastando) return;
    const dx = e.clientX - st.ultimoX, dy = e.clientY - st.ultimoY;
    st.ultimoX = e.clientX; st.ultimoY = e.clientY;
    const ang = Math.hypot(dx, dy) * g.sens;
    if (ang < 1e-6) return;
    // eixo de giro perpendicular ao arrasto, no plano da tela (trackball): a face da frente acompanha o dedo
    eixo.set(dy, dx, 0).normalize().applyQuaternion(camera.quaternion);
    dq.setFromAxisAngle(eixo, ang); st.q.premultiply(dq);
    const agora = agoraMs(), dtm = Math.max((agora - st.ultimoMov) / 1000, 1 / 240);
    st.ultimoMov = agora;
    wInst.copy(eixo).multiplyScalar(Math.min(ang / dtm, 10));
    st.w.lerp(wInst, 0.5);      // só a estimativa da velocidade para a inércia ao soltar
    st.ultimaInteracao = agora;
  }, sinal);
  canvas.addEventListener('pointerleave', () => { if (!agarrada?.st.arrastando) { cam.alvoAz = 0; cam.alvoEl = 0; } }, sinal);
  const camDir = new THREE.Vector3();
  function teclar(g, e) {
    const st = g?.st;
    if (!st?.interativa || !g.ativa || troca.ativa) return;
    const lado = { ArrowLeft: -1, ArrowRight: 1 }[e.key], vert = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (lado) { pegar(g); st.w.y = THREE.MathUtils.clamp(st.w.y + lado * 2.4, -4, 4); }
    if (vert) { pegar(g); camDir.set(1, 0, 0).applyQuaternion(camera.quaternion); st.w.addScaledVector(camDir, vert * 2.6).clampLength(0, 4); }
    if (e.key === 'Home' || e.key === 'Escape') { st.ultimaInteracao = -1e9; st.pousando = st.noAr; }
    if (lado || vert || e.key === 'Home') { st.ultimaInteracao = e.key === 'Home' ? -1e9 : agoraMs(); e.preventDefault(); }
  }
  // com uma garrafa à vista, o canvas recebe o foco; nas duas, cada uma tem o seu alvo de foco (abaixo)
  canvas.addEventListener('keydown', (e) => teclar(modo === 'ambas' ? agarrada : G[modo], e), sinal);

  // ---------- foco pelo teclado nas duas juntas: um alvo invisível sobre cada garrafa, dentro do pai do canvas.
  // Posição só no redimensionamento e durante a troca de modo (escrita de estilo, nenhuma leitura de layout por quadro)
  const focos = new Map(), pai = canvas.parentElement, desloc = { x: 0, y: 0 };
  let focosSujos = false;
  function medirFocos() {
    if (!focos.size) return;
    const a = canvas.getBoundingClientRect(), b = pai.getBoundingClientRect();
    desloc.x = a.left - b.left - pai.clientLeft; desloc.y = a.top - b.top - pai.clientTop;
    focosSujos = true;
  }
  function criarFocos() {
    if (!pai || focos.size) return;
    if (getComputedStyle(pai).position === 'static') pai.style.position = 'relative';
    for (const g of lista) {
      const d = document.createElement('div');
      d.className = 'garrafa-foco'; d.tabIndex = 0; d.dataset.garrafa = g.id;
      d.setAttribute('role', 'application'); d.setAttribute('aria-roledescription', 'garrafa 3D interativa'); d.setAttribute('aria-label', g.rotulo);
      Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', borderRadius: '12px' });
      d.addEventListener('keydown', (e) => teclar(g, e), sinal);
      d.addEventListener('focus', () => { agarrada = g; }, sinal);
      pai.appendChild(d); focos.set(g.id, d);
    }
    canvas.tabIndex = -1;
    medirFocos();
  }
  function removerFocos() {
    if (!focos.size) return;
    const tinhaFoco = [...focos.values()].includes(document.activeElement);
    for (const d of focos.values()) d.remove();
    focos.clear();
    canvas.tabIndex = tabOriginal;
    if (tinhaFoco) canvas.focus({ preventScroll: true });
  }
  function posicionarFocos() {
    focosSujos = false;
    for (const [id, d] of focos) {
      const g = G[id];
      if (!g.ativa || !g.garrafa) continue;
      const q = retangulo(g), m = 6;
      d.style.transform = `translate(${(desloc.x + q.x0 - m).toFixed(1)}px, ${(desloc.y + q.y0 - m).toFixed(1)}px)`;
      d.style.width = `${(q.x1 - q.x0 + 2 * m).toFixed(1)}px`; d.style.height = `${(q.y1 - q.y0 + 2 * m).toFixed(1)}px`;
    }
  }

  const cimaGarrafa = new THREE.Vector3(), qErro = new THREE.Quaternion(), torque = new THREE.Vector3();
  const wDt = new THREE.Vector3();
  function mover(g, dt, agora, pose) {
    const st = g.st, POSE = g.tipo.pose, RAIO_QUINA = g.raioQuina, centro = g.centro;
    const parado = (agora - st.ultimaInteracao) / 1000;
    cimaGarrafa.copy(EIXO_Y).applyQuaternion(st.q);
    if (st.arrastando) {
      // dedo parado segurando: a inércia some
      if ((agora - st.ultimoMov) > 40) st.w.multiplyScalar(Math.exp(-dt * 14));
    } else if (st.noAr) {
      st.w.multiplyScalar(Math.exp(-dt * (st.pousando ? 0 : 2.6)));     // gira solta e perde velocidade (~0,4 s)
      if (!st.pousando && cfg.repouso > 0 && (parado > cfg.repouso || reduzir) && st.w.length() < 1.2) st.pousando = true;
      if (st.pousando) {
        // mola de torção criticamente amortecida: o eixo volta à vertical sem passar do ponto
        qErro.setFromUnitVectors(cimaGarrafa, EIXO_Y);
        const ang = 2 * Math.acos(THREE.MathUtils.clamp(qErro.w, -1, 1));
        torque.set(qErro.x, qErro.y, qErro.z);
        const k = reduzir ? 100 : 36, c = 2 * Math.sqrt(k);
        if (torque.lengthSq() > 1e-12) torque.normalize().multiplyScalar(ang * k);
        else torque.set(0, 0, 0);
        st.w.x += (torque.x - st.w.x * c) * dt;
        st.w.z += (torque.z - st.w.z * c) * dt;
        st.w.y += (torque.y - st.w.y * 3) * dt;
        if (ang < 0.01 && st.alt < 0.0006 && Math.abs(st.altVel) < 0.02) {
          st.noAr = false; st.pousando = false; st.ultimaInteracao = agora; st.fase = 0;
          st.q.premultiply(qErro);   // assenta exatamente em pé
          st.w.x = st.w.z = 0;
        }
      }
    } else {
      // no piso: depois de um tempo parada, volta para a pose de vitrine e balança devagar (±20°, ~12 s)
      st.w.x = st.w.z = 0;
      const ganho = pausado ? 0 : easeInOut(clamp01((parado - 1.2) / 1.5));
      if (ganho > 0) {
        if (!reduzir) st.fase += dt * 2 * Math.PI * g.tipo.freqBalanco * ganho;
        const giro = 2 * Math.atan2(st.q.y, st.q.w);
        const alvo = POSE + (reduzir ? 0 : cfg.balanco * Math.sin(st.fase + g.tipo.defasagem));
        const d = Math.atan2(Math.sin(alvo - giro), Math.cos(alvo - giro));
        st.w.y += (d * 9 * ganho - st.w.y * 6) * dt;    // mola crítica (~1 s)
      } else st.w.y *= Math.exp(-dt * 2.6);
    }
    // integra a rotação
    const wl = st.w.length();
    // (arrastando, quem gira é o próprio dedo; st.w só guarda a velocidade para quando soltar)
    if (!st.arrastando && wl > 1e-6) { wDt.copy(st.w).divideScalar(wl); dq.setFromAxisAngle(wDt, wl * dt); st.q.premultiply(dq).normalize(); }

    // altura: sobe quando pega, desce ao pousar (sem quicar); nunca atravessa o piso (ponto mais baixo do corpo inclinado)
    cimaGarrafa.copy(EIXO_Y).applyQuaternion(st.q);
    const uy = Math.abs(cimaGarrafa.y), lado = Math.sqrt(Math.max(0, 1 - uy * uy));
    const altMin = Math.max(0, centro * uy + RAIO_QUINA * lado - centro);
    const quaseEmPe = cimaGarrafa.y > 0.94;
    const noAlto = st.noAr && !(st.pousando && quaseEmPe);
    const altAlvo = noAlto ? NO_AR : 0;
    const kA = reduzir ? 400 : 144;
    st.altVel += ((altAlvo - st.alt) * kA - st.altVel * 2 * Math.sqrt(kA)) * dt;
    st.alt += st.altVel * dt;
    if (st.alt < altMin) { st.alt = altMin; st.altVel = Math.max(st.altVel, 0); }
    // nas duas juntas, a pega vem para a frente junto com a subida e volta ao pousar
    const frenteAlvo = noAlto && modo === 'ambas' ? FRENTE : 0;
    st.frenteVel += ((frenteAlvo - st.frente) * kA - st.frenteVel * 2 * Math.sqrt(kA)) * dt;
    st.frente += st.frenteVel * dt;
    pose.uy = cimaGarrafa.y; pose.lado = lado; pose.baixo = centro + st.alt - (centro * uy + RAIO_QUINA * lado);
  }

  // ---------- simulação do líquido
  // A superfície tem normal própria no mundo: segue a gravidade com uma mola (passa do ponto e volta), é empurrada
  // pela aceleração da garrafa e arrastada um pouco quando ela gira. O nível sai do volume: a cada quadro procura a
  // altura, ao longo dessa normal, que deixa exatamente o volume de suco abaixo (em pé, deitada ou de cabeça para baixo).
  const P = new THREE.Vector3(), Vn = new THREE.Vector3(), A = new THREE.Vector3(), alvoN = new THREE.Vector3();
  const F = new THREE.Vector3(), nLoc = new THREE.Vector3(), cLoc = new THREE.Vector3(), qInv = new THREE.Quaternion();
  function simularLiquido(g, dt, fracao, agitacao) {
    const { st, liq, U, garrafa, raiz, volume } = g;
    P.copy(g.centroSuco); garrafa.localToWorld(P);
    if (liq.prim) { liq.pos.copy(P); liq.vel.set(0, 0, 0); liq.n.set(0, 1, 0); liq.nv.set(0, 0, 0); liq.wyAnt = st.w.y; liq.prim = false; }
    Vn.copy(P).sub(liq.pos).divideScalar(Math.max(dt, 1e-4));
    Vn.lerp(liq.vel, 0.5);                            // suaviza o ruído de quadro a quadro
    A.copy(Vn).sub(liq.vel).divideScalar(Math.max(dt, 1e-4)).clampLength(0, 8);
    liq.pos.copy(P); liq.vel.copy(Vn);
    // equilíbrio: perpendicular à gravidade efetiva (com ganho para a inclinação ficar visível)
    const G = 1.6 / 9.81;
    alvoN.set(-A.x * G, 1, -A.z * G).normalize();
    // girar a garrafa arrasta o suco junto (atrito nas paredes); ele fica para trás e depois volta
    const wl = st.w.length();
    if (wl > 1e-4) liq.n.applyAxisAngle(F.copy(st.w).divideScalar(wl), Math.min(wl * dt, 0.25) * 0.22);
    // girar a garrafa quadrada no eixo empurra o suco de lado
    const alfaY = THREE.MathUtils.clamp((st.w.y - liq.wyAnt) / Math.max(dt, 1e-4), -60, 60);
    liq.wyAnt = st.w.y;
    liq.nv.x += alfaY * 0.016 * dt * 60 * Math.max(0, liq.n.y);
    // 1º modo de um tanque de 6 cm: ~3,6 Hz, decai ~2/s; com espuma (logo depois de encher) amortece bem mais
    const K = 515, C = 4 + 16 * Math.min(U.uFoam.value, 1);
    F.copy(alvoN).sub(liq.n).multiplyScalar(K).addScaledVector(liq.nv, -C);
    liq.nv.addScaledVector(F, dt);
    liq.n.addScaledVector(liq.nv, dt).normalize();
    liq.nv.addScaledVector(liq.n, -liq.nv.dot(liq.n));
    const desvio = liq.n.angleTo(alvoN);
    if (desvio > 0.38) liq.n.lerp(alvoN, 1 - 0.38 / desvio).normalize();

    // nível que conserva o volume, no espaço da garrafa
    qInv.copy(raiz.quaternion).invert();
    nLoc.copy(liq.n).applyQuaternion(qInv);
    const h = volume.nivel(nLoc, fracao, cLoc);
    // ponto da superfície: centro do suco projetado no plano
    cLoc.addScaledVector(nLoc, h - cLoc.dot(nLoc));
    U.uNLoc.value.copy(nLoc); U.uP0Loc.value.copy(cLoc);
    U.uP0.value.copy(cLoc); garrafa.localToWorld(U.uP0.value);
    U.uN.value.copy(liq.n);
    const aux = Math.abs(liq.n.x) < 0.9 ? 'x' : 'z';
    U.uT1.value.set(+(aux === 'x'), 0, +(aux === 'z')).addScaledVector(liq.n, -liq.n[aux]).normalize();
    U.uT2.value.crossVectors(U.uT1.value, liq.n).normalize();

    // redemoinho quando gira no próprio eixo em pé; marolas com a agitação
    const wEixo = THREE.MathUtils.clamp(st.w.dot(F.copy(EIXO_Y).applyQuaternion(raiz.quaternion)), -10, 10) * Math.max(0, nLoc.y);
    liq.spin = THREE.MathUtils.lerp(liq.spin, wEixo, 1 - Math.exp(-dt * 1.4));
    const energia = liq.nv.length() + Math.min(wl, 12) * 0.04;
    liq.ripple = THREE.MathUtils.lerp(liq.ripple, Math.min(0.0007, energia * 0.00018 + agitacao), 1 - Math.exp(-dt * 6));
    // sacudir faz um pouco de espuma, que assenta devagar
    liq.espuma = Math.max(liq.espuma * Math.exp(-dt * 0.35), Math.min(0.35, Math.max(0, energia - 0.6) * 0.2));
    U.uSpin.value = 2.2 * liq.spin * liq.spin / (2 * 9.81);
    U.uRipple.value = liq.ripple;
  }

  // ---------- ritmo
  // Até ~60 quadros/s: em tela de 120/144 Hz desenha um tique do rAF sim, um não. Imagem igual à anterior não é
  // redesenhada (pausada, movimento reduzido, tudo assentado). Se o aparelho não acompanhar, o ritmo cai para a
  // metade (constante é melhor que quadros irregulares); a resolução nunca cai. Com folga clara por ~2 s, tenta
  // voltar (no máximo duas vezes, para não ficar oscilando).
  const ritmo = {
    tela: 1000 / 60, amostrasTela: [], ultimoTique: 0, desenhouAntes: false, conta: 0, base: 1, divisor: 1, meia: false,
    quadros: [], folga: [], ultimoQuadro: 0, subidas: 0, espera: 0, pulou: false,
  };
  // mediana dos últimos n valores de a, sem alocar (cópia num buffer fixo e k-ésimo menor)
  const auxMediana = new Float64Array(128);
  const mediana = (a, n = a.length) => { const o = a.length - n; for (let i = 0; i < n; i++) auxMediana[i] = a[o + i]; return selecionar(auxMediana, n >> 1, n); };
  function tique(ts) {   // devolve true se este tique do rAF deve desenhar
    const iv = ts - ritmo.ultimoTique; ritmo.ultimoTique = ts;
    // o intervalo da tela só é medido em tiques sem desenho antes (o desenho atrasa o tique seguinte)
    if (!ritmo.desenhouAntes && iv > 2 && iv < 100) {
      ritmo.amostrasTela.push(iv); if (ritmo.amostrasTela.length > 31) ritmo.amostrasTela.shift();
      if (ritmo.amostrasTela.length >= 5) {
        ritmo.tela = mediana(ritmo.amostrasTela);
        ritmo.base = Math.max(1, Math.floor((1000 / 60 + 1) / ritmo.tela));
        ritmo.divisor = ritmo.base * (ritmo.meia ? 2 : 1);
      }
    } else if (ritmo.desenhouAntes && ritmo.meia && iv > 2 && iv < 200) {
      // em meia velocidade: o tique logo depois de um desenho chega no tempo se o quadro coube no orçamento do ritmo cheio
      ritmo.folga.push(iv / (ritmo.tela * ritmo.base)); if (ritmo.folga.length > 90) ritmo.folga.shift();
    }
    return ++ritmo.conta % ritmo.divisor === 0;
  }
  function avaliar(ts) {   // depois de cada quadro desenhado: o aparelho está acompanhando?
    const fator = ritmo.pulou ? 2 : 1; ritmo.pulou = false;   // depois de um pulo do ritmo calmo, o intervalo é duplo
    const iv = ts - ritmo.ultimoQuadro, esperado = ritmo.tela * ritmo.divisor * fator, anterior = ritmo.ultimoQuadro;
    ritmo.ultimoQuadro = ts;
    if (!anterior || iv > esperado * 4) return;   // o quadro anterior não foi desenhado (fora da tela, imagem parada, aba)
    if (!cfg.adaptar || ritmo.espera > 0) { ritmo.espera--; return; }
    ritmo.quadros.push(iv / esperado); if (ritmo.quadros.length > 120) ritmo.quadros.shift();
    if (!ritmo.meia && ritmo.quadros.length >= 40 && mediana(ritmo.quadros, 40) > 1.3) {
      ritmo.meia = true; ritmo.divisor = ritmo.base * 2;
      ritmo.quadros.length = 0; ritmo.folga.length = 0; ritmo.espera = 30;
    } else if (ritmo.meia && ritmo.subidas < 2 && ritmo.folga.length >= 60 && mediana(ritmo.folga) < 1.15) {
      ritmo.meia = false; ritmo.subidas++; ritmo.divisor = ritmo.base;
      ritmo.quadros.length = 0; ritmo.folga.length = 0; ritmo.espera = 30;
    }
  }
  // imagem igual à anterior? (posições, câmera, nível e efeitos do suco; o tempo só conta se houver marola ou espuma)
  const POR = 20, firma = new Float64Array(3 + POR * lista.length), firmaDesenhada = new Float64Array(firma.length).fill(NaN);
  function mudou() {
    const f = firma, c = camera.position;
    f[0] = c.x; f[1] = c.y; f[2] = c.z;
    let vivo = false;
    for (let k = 0; k < lista.length; k++) {
      const g = lista[k], o = 3 + POR * k;
      if (!g.ativa) { f.fill(0, o, o + POR); continue; }
      const q = g.raiz.quaternion, p0 = g.raiz.position, n = g.U.uN.value, p = g.U.uP0.value, s = g.sombra;
      f[o] = q.x; f[o + 1] = q.y; f[o + 2] = q.z; f[o + 3] = q.w; f[o + 4] = p0.x; f[o + 5] = p0.y; f[o + 6] = p0.z;
      f[o + 7] = n.x; f[o + 8] = n.y; f[o + 9] = n.z; f[o + 10] = p.x; f[o + 11] = p.y; f[o + 12] = p.z;
      f[o + 13] = g.U.uSpin.value; f[o + 14] = g.U.uOrvalho.value; f[o + 15] = g.tampa.position.y; f[o + 16] = g.tampa.rotation.y;
      f[o + 17] = s.material.opacity; f[o + 18] = s.scale.x; f[o + 19] = s.scale.y;
      vivo ||= g.jato.visible || g.U.uRipple.value > 2e-6 || g.U.uFoam.value > 0.002 || (g.tipo.quieto ? !g.tipo.quieto(g) : false);
    }
    for (let i = 0; i < f.length; i++) if (!(Math.abs(f[i] - firmaDesenhada[i]) <= 1e-6)) return true;   // (NaN conta como mudança)
    return vivo;
  }
  // só o balanço lento no piso (±20° em ~12 s, menos de 1 px por quadro): 30 quadros por segundo bastam e a imagem é a
  // mesma. Arrastar, inércia, entrada, espuma, troca de modo ou paralaxe voltam na hora para o ritmo cheio
  const quieta = (g) => {
    const st = g.st, U = g.U;
    return st.interativa && !st.arrastando && !st.noAr && !st.pousando && !g.jato.visible && U.uFoam.value < 0.002
      && U.uRipple.value < 2e-6 && Math.abs(st.w.x) + Math.abs(st.w.z) < 1e-4 && Math.abs(st.w.y) < 0.25
      && Math.abs(st.frenteVel) < 1e-4 && (!g.tipo.quieto || g.tipo.quieto(g));
  };

  // piso: centro e altura de cada garrafa à vista (o shader esmaece o reflexo de cada uma pela altura dela)
  function atualizarPiso() {
    let a = null, b = null;
    for (const g of lista) if (g.ativa) { if (!a) a = g; else b = g; }
    if (!a) return;
    const m = b ? pisoDuplo : pisoSimples;
    if (m && piso.material !== m) { piso.material = m; sujo = true; }
    const u = pisoSimples.uniforms;   // as duas variantes usam os mesmos uniforms
    u.uCentro.value.copy(a.raiz.position); u.uAltura.value = a.altura;
    if (b) {
      u.uCentroB.value.copy(b.raiz.position); u.uAlturaB.value = b.altura;
      u.uLargura.value = a.meiaLarguraAgora; u.uLarguraB.value = b.meiaLarguraAgora;
    }
  }

  // ---------- laço
  let ultimo = agoraMs(), visivel = true, calmo = false, pulo = false, fundo = false;
  const boca = new THREE.Vector3(), eixoSombra = new THREE.Vector3(), camAnt = new THREE.Vector3();
  function passoGarrafa(g, dt, agora) {
    const { st, liq, U, tipo } = g, T = tipo.T;
    const t = g.t = (agora - g.inicio) / 1000;
    // --- entrada: enche, para o jato, tampa desce e rosqueia; depois a condensação aparece
    const enchendo = clamp01((t - T.encherIni) / (T.encherFim - T.encherIni));
    g.nivelEmPe = THREE.MathUtils.lerp(0.0015, g.nivel, easeInOut(enchendo) * 0.85 + enchendo * 0.15);
    const jatoAtivo = g.jatoAtivo = t > T.jatoIni && t < T.encherFim + 0.35;
    let agitacao = 0;
    if (jatoAtivo) {
      agitacao = t < T.encherFim ? 0.00055 : 0.0002;
      if (t < T.encherFim) liq.nv.x += (Math.random() - 0.5) * 0.045 * dt * 60;
    }
    g.agitacao = agitacao;
    const espumaIntro = t < T.encherFim ? Math.min(1, enchendo * 3) : Math.max(0, 1 - (t - T.encherFim) / 3);
    U.uFoam.value = Math.max(espumaIntro, liq.espuma);
    U.uOrvalho.value = easeInOut(clamp01((t - T.encherFim - 0.6) / 3.5));
    tipo.tampa(g, t);

    if (!st.interativa && t >= T.tampaFim) {
      st.interativa = true; st.ultimaInteracao = -1e9; cfg.aoTerminarIntro?.(g.id);
    }

    // --- movimento
    const pose = g.pose;
    if (!st.interativa) {
      // termina na pose de vitrine
      st.q.setFromAxisAngle(EIXO_Y, tipo.pose - 0.55 * (1 - easeInOut(clamp01(t / T.tampaFim))));
      st.w.set(0, 0, 0); st.alt = 0; st.altVel = 0; st.noAr = false; st.frente = 0; st.frenteVel = 0;
      pose.uy = 1; pose.lado = 0; pose.baixo = 0;
    } else mover(g, dt, agora, pose);
    g.raiz.position.set(g.x, g.centro + st.alt, st.frente);
    g.raiz.quaternion.copy(st.q);

    // sombra de contato: estica com a garrafa deitada, abre e some quando ela sobe
    const sombra = g.sombra;
    const ax = eixoSombra.copy(EIXO_Y).applyQuaternion(st.q);
    sombra.position.x = g.x; sombra.position.z = st.frente;
    sombra.rotation.set(-Math.PI / 2, 0, Math.atan2(-ax.z, ax.x));
    const abre = 1 + Math.max(pose.baixo, 0) * 14;
    sombra.scale.set((1 + pose.lado * tipo.esticaSombra) * abre * g.escalaSombra, abre * g.escalaSombra, 1);
    sombra.material.opacity = (piso ? 0.15 : 0.75) * Math.exp(-Math.max(pose.baixo, 0) * 38);   // acrílico quase não tem sombra
    // meia largura na tela (do eixo do quadro): com a garrafa deitada, a câmera recua o necessário para caber inteira
    g.meiaLarguraAgora = g.centro * pose.lado + g.meiaLargura * Math.abs(pose.uy) + 0.016;
    return Math.abs(g.xFim) + g.meiaLarguraAgora;
  }
  function passoSuco(g, dt, agora) {
    const { U, tipo } = g, T = tipo.T, t = g.t;
    U.uBottleInv.value.copy(g.garrafa.matrixWorld).invert();
    simularLiquido(g, dt, g.volume.fracaoAte(g.nivelEmPe), g.agitacao);

    // --- jato de suco entrando pela boca
    const jato = g.jato;
    jato.visible = g.jatoAtivo;
    if (g.jatoAtivo) {
      const topo = 0.42, sup = U.uP0.value.y;
      const pontaCaindo = THREE.MathUtils.lerp(topo, sup, easeOut(clamp01((t - T.jatoIni) / 0.22)));
      const cauda = t > T.encherFim ? THREE.MathUtils.lerp(topo, sup, easeOut(clamp01((t - T.encherFim) / 0.3))) : topo;
      boca.set(0, g.bocaY, 0); g.garrafa.localToWorld(boca);
      jato.position.set(boca.x, cauda, boca.z);
      jato.scale.set(1, Math.max(cauda - Math.max(pontaCaindo, sup - 0.004), 0.0001), 1);
    }
    tipo.atualizar?.(g, dt, t, agora);
  }
  function quadroAnimado(ts) {
    const desenhar = tique(ts);
    ritmo.desenhouAntes = false;
    if (!desenhar) return;
    if (!visivel || !pronto) { ritmo.ultimoQuadro = 0; return; }
    if (calmo && (pulo = !pulo)) { ritmo.pulou = true; return; }
    const agora = agoraMs();
    const dt = Math.min((agora - ultimo) / 1000, 1 / 30); ultimo = agora;
    uTempo.value = agora / 1000;
    const trocando = passoTroca(agora);

    let meiaLargura = 0, todasLivres = true;
    subida = 0; recuo = 0;
    for (const g of lista) {
      if (!g.ativa) continue;
      const m = passoGarrafa(g, dt, agora);
      if (g.saindo) continue;
      meiaLargura = Math.max(meiaLargura, m);
      subida = Math.max(subida, g.st.alt);
      recuo = Math.max(recuo, g.st.frente);
      todasLivres &&= g.st.interativa;
    }
    if (piso) atualizarPiso();

    // câmera: paralaxe leve com o mouse; com uma garrafa deitada, recua o necessário para ela caber inteira no quadro
    const kAlvo = Math.max(1, meiaLargura / (quadro.dist * cam.kBase * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    cam.kDin += (kAlvo - cam.kDin) * suave(kAlvo > cam.kDin ? 5 : 1.5, dt);
    cam.k = cam.kBase * cam.kDin;
    cam.az += (cam.alvoAz - cam.az) * suave(3, dt);
    cam.el += (cam.alvoEl - cam.el) * suave(3, dt);
    posicionarCamera(subida);

    scene.updateMatrixWorld();
    for (const g of lista) if (g.ativa) passoSuco(g, dt, agora);

    calmo = !trocando && camera.position.distanceToSquared(camAnt) < 1e-12;
    for (const g of lista) if (calmo && g.ativa) calmo = quieta(g);
    camAnt.copy(camera.position);
    if (!calmo) pulo = false;
    // a outra garrafa: depois da entrada, baixa, monta e compila aos poucos no tempo ocioso (a troca fica instantânea)
    if (!fundo && todasLivres) { fundo = true; prepararFundo(); }
    if (!trocando && !sujo && !mudou()) { ritmo.ultimoQuadro = 0; ritmo.pulou = false; return; }
    if (sujo || trocando) mudou();
    firmaDesenhada.set(firma); sujo = false;
    renderer.render(scene, camera);
    if (desvanecer) { renderer.autoClear = false; renderer.render(desvanecer, camera); renderer.autoClear = true; }
    ritmo.desenhouAntes = true;
    avaliar(ts);
    if (focos.size && (trocando || focosSujos)) posicionarFocos();
    if (avisarCarregou) { avisarCarregou = false; cfg.aoCarregar?.(); }
  }
  function prepararFundo() {
    for (const g of lista) {
      if (g.preparo) continue;
      g.urgente = false;
      ocioso(() => { if (!destruido) preparar(g, true).catch(() => {}); }, 2000);   // falhou: tenta de novo quando for mostrada
    }
  }

  // ---------- montagem pesada (contexto WebGL, estúdio, GLB) só quando o navegador estiver ocioso: a página pinta antes
  let roTamanho = null, roPosicao = null, io = null;
  function iniciar() {
    if (destruido) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { falhar(e); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = cfg.exposicao;
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(estudio(), 0).texture;

    if (cfg.piso) {
      // disco de 45 cm sem a parte de trás: atrás da garrafa (z < -16 cm) o reflexo é sempre vazio (o reflexo de um ponto
      // cai entre ele e a câmera, e a garrafa nunca passa de ~10 cm do eixo), e ali o shader do piso só gastava 13 leituras
      const forma = new THREE.Shape(), a0 = Math.asin(0.16 / 0.45);   // (x, y) local; y local = -z do mundo
      forma.moveTo(0.45 * Math.cos(a0), 0.16); forma.absarc(0, 0, 0.45, a0, Math.PI - a0, true); forma.closePath();
      piso = new Reflector(new THREE.ShapeGeometry(forma, 96), { clipBias: 0.0003, shader: SHADER_PISO, multisample: 0, textureWidth: 512, textureHeight: 512 });
      piso.rotation.x = -Math.PI / 2;
      const mistura = { transparent: true, depthWrite: false, blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
      pisoSimples = Object.assign(piso.material, mistura, { defines: { NUM_GARRAFAS: 1 } });
      // duas garrafas à vista (modo 'ambas' e as trocas): outra variante do mesmo shader, com os mesmos uniforms
      if (lista.length > 1) {
        pisoDuplo = Object.assign(new THREE.ShaderMaterial({ name: SHADER_PISO.name, uniforms: pisoSimples.uniforms,
          vertexShader: SHADER_PISO.vertexShader, fragmentShader: SHADER_PISO.fragmentShader, defines: { NUM_GARRAFAS: 2 } }), mistura);
      }
      piso.renderOrder = -2;
      scene.add(piso);
    }
    uRuido.value = texturaRuido();
    desvanecer = cfg.desvanecer ? criarDesvanecer(cfg.desvanecer) : null;

    // WebGL sem placa de vídeo (aceleração desligada, máquina virtual): tudo roda na CPU; começa em meia velocidade
    const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const semGpu = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
    if (semGpu && cfg.adaptar) { ritmo.meia = true; ritmo.divisor = 2; ritmo.subidas = 2; }   // na CPU, não tenta voltar

    roTamanho = new ResizeObserver(redimensionar); roTamanho.observe(canvas); redimensionar();
    // tela trocou de densidade (janela arrastada para outro monitor, zoom): refaz o tamanho do buffer
    const vigiarDpr = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { if (!destruido) { redimensionar(); vigiarDpr(); } }, { once: true, ...sinal });
    vigiarDpr();
    roPosicao = new ResizeObserver(() => { medir(); medirFocos(); }); roPosicao.observe(canvas);
    if (pai) roPosicao.observe(pai);
    io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }); io.observe(canvas);
    canvas.addEventListener('webglcontextrestored', () => { sujo = true; }, sinal);
    renderer.setAnimationLoop(quadroAnimado);
    prontoPromessa = arrancar();
  }
  async function arrancar() {
    try {
      renderer.initTexture(uRuido.value);
      if (desvanecer) renderer.compile(desvanecer, camera);
      if (pisoDuplo) renderer.compile(new THREE.Mesh(piso.geometry, pisoDuplo), camera, scene);
      const esperaPiso = piso ? renderer.compileAsync(piso, camera, scene) : null;
      let alvo;
      do { alvo = modo; await Promise.all(MODOS[alvo].map((id) => preparar(G[id]))); } while (!destruido && alvo !== modo);
      await esperaPiso;
    } catch (e) { if (!destruido) falhar(e); return; }
    if (destruido) return;
    // já no lugar do modo, sem troca; nas duas, o vidro começa a encher um pouco depois da PET
    quadroDe(modo, quadro); enquadrar();
    const agora = agoraMs();
    let atraso = 0;
    for (const g of lista) {
      if (!MODOS[modo].includes(g.id)) continue;
      g.x = g.xIni = g.xFim = xDe(modo, g);
      g.inicio = agora + atraso;
      if (!cfg.intro) g.inicio -= g.tipo.T.tampaFim * 1000 + 4000;
      atraso += ATRASO_VIDRO * 1000;
      g.entrou = true;
      exibir(g, true);
    }
    if (piso) atualizarPiso();
    if (modo === 'ambas') criarFocos();
    ultimo = agoraMs();
    pronto = true; avisarCarregou = true; sujo = true;
    // os bytes da outra garrafa já vêm agora, sem pressa (só rede); montar e compilar fica para depois da entrada
    for (const g of lista) if (!g.bytes) { g.urgente ??= false; ocioso(() => { if (!destruido) obterBytes(g); }, 2000); }
  }
  ocioso(iniciar, 200);

  return {
    get renderer() { return renderer; }, scene, camera,
    garrafas: new Map(lista.map((g) => [g.id, { liquido: g.liq }])),
    get modo() { return modo; },
    mostrar,
    // toca a entrada de novo (de uma garrafa ou das que estão à vista; nas duas, o vidro um pouco depois da PET)
    reiniciar(id) {
      if (!pronto) return;
      zerar();
      let atraso = 0;
      for (const g of lista) {
        if (!g.ativa || g.saindo || (id && g.id !== id)) continue;
        const { st, liq } = g;
        g.inicio = agoraMs() + atraso; liq.prim = true; liq.espuma = 0;
        Object.assign(st, { interativa: false, noAr: false, pousando: false, avisou: false, fase: 0 });
        atraso += ATRASO_VIDRO * 1000;
      }
    },
    pausarGiro(v = true) { pausado = v; },
    get pausado() { return pausado; },
    // para tudo e libera a GPU (ex.: ao desmontar o componente num app React/Vue)
    destruir() {
      if (destruido) return;
      destruido = true; zerar(); ac.abort(); removerFocos();
      roTamanho?.disconnect(); roPosicao?.disconnect(); io?.disconnect();
      troca.fim?.(modo);
      if (!renderer) return;
      renderer.setAnimationLoop(null);
      for (const g of lista) g.tipo.descartar?.(g);
      scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.normalMap?.dispose(); m.dispose(); }); });
      pisoSimples?.dispose(); pisoDuplo?.dispose();
      piso?.getRenderTarget().dispose(); scene.environment?.dispose(); pmrem.dispose();
      desvanecer?.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      uRuido.value?.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const suave = (taxa, dt) => 1 - Math.exp(-dt * taxa);

// ---------- volume do suco
// Amostras espalhadas por dentro do perfil interno (malha de pontos com sorteio dentro de cada célula). Para uma normal
// qualquer, o nível é a altura que deixa a fração certa das amostras abaixo dela (k-ésimo menor, sem ordenar tudo).
function criarVolume(perfil, alvo = 5000) {
  const pts = perfil.map(([r, y]) => [r, y]);
  const rMax = Math.max(...pts.map((p) => p[0])), yMin = Math.min(...pts.map((p) => p[1])), yMax = Math.max(...pts.map((p) => p[1]));
  const nEm = (y) => {   // expoente da superelipse na altura y
    let melhor = perfil[0][2], dist = Infinity;
    for (const [r, yy, n] of perfil) if (r > 0 && Math.abs(yy - y) < dist) { dist = Math.abs(yy - y); melhor = n; }
    return melhor;
  };
  const dentro = (rho, y) => {   // (rho, y) dentro do polígono do perfil, fechado pelo eixo
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && rho < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const lado = Math.cbrt((4 * rMax * rMax * (yMax - yMin)) / (alvo * 1.4));
  const nx = Math.ceil((2 * rMax) / lado), ny = Math.ceil((yMax - yMin) / lado);
  let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lista = [];
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nx; iz++) {
      const y = yMin + (iy + rnd()) * lado, n = nEm(y);   // sorteio próprio em cada célula: o nível sobe liso, sem degraus
      const x = -rMax + (ix + rnd()) * lado, z = -rMax + (iz + rnd()) * lado;
      if (dentro(Math.pow(Math.pow(Math.abs(x), n) + Math.pow(Math.abs(z), n), 1 / n), y)) lista.push(x, y, z);
    }
  }
  const S = new Float32Array(lista), N = S.length / 3, alt = new Float32Array(N);
  const raioEm = (y) => {   // maior raio do perfil na altura y
    let r = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y)) r = Math.max(r, xi + ((xj - xi) * (y - yi)) / (yj - yi));
    }
    return r;
  };
  const ys = Float32Array.from({ length: N }, (_, i) => S[3 * i + 1]).sort();
  const ant = { x: NaN, y: NaN, z: NaN, f: NaN, h: 0, cx: 0, cy: 0, cz: 0 };
  return {
    amostrarPerfil(lista, faixa) {   // (raio, expoente) por altura, para o shader medir a espessura do suco
      faixa.set(yMin, yMax);
      lista.forEach((v, i) => { const y = yMin + ((yMax - yMin) * i) / (lista.length - 1); v.set(raioEm(Math.min(Math.max(y, yMin + 1e-5), yMax - 1e-5)), nEm(y)); });
    },
    fracaoAte(y) {   // fração do volume abaixo da altura y com a garrafa em pé
      let lo = 0, hi = N;
      while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m] < y) lo = m + 1; else hi = m; }
      return lo / N;
    },
    nivel(u, fracao, centroide) {   // u: normal da superfície no espaço da garrafa; devolve a altura ao longo de u
      // mesma normal e mesmo volume do quadro anterior (garrafa parada ou girando em pé): reaproveita a conta
      if (fracao === ant.f && Math.abs(u.x - ant.x) < 1e-7 && Math.abs(u.y - ant.y) < 1e-7 && Math.abs(u.z - ant.z) < 1e-7) {
        centroide.set(ant.cx, ant.cy, ant.cz); return ant.h;
      }
      for (let i = 0; i < N; i++) alt[i] = S[3 * i] * u.x + S[3 * i + 1] * u.y + S[3 * i + 2] * u.z;
      const k = Math.min(N - 1, Math.max(0, Math.round(fracao * N) - 1));
      const h = selecionar(alt, k) + (fracao <= 0 ? -0.001 : 0);
      // centro do suco (média das amostras abaixo do nível)
      let cx = 0, cy = 0, cz = 0, c = 0;
      for (let i = 0; i < N; i++) {
        const v = S[3 * i] * u.x + S[3 * i + 1] * u.y + S[3 * i + 2] * u.z;
        if (v <= h) { cx += S[3 * i]; cy += S[3 * i + 1]; cz += S[3 * i + 2]; c++; }
      }
      if (c) centroide.set(cx / c, cy / c, cz / c); else centroide.set(0, yMin, 0);
      Object.assign(ant, { x: u.x, y: u.y, z: u.z, f: fracao, h, cx: centroide.x, cy: centroide.y, cz: centroide.z });
      return h;
    },
  };
}
function selecionar(a, k, n = a.length) {   // k-ésimo menor dos n primeiros (quickselect; mexe na ordem de a)
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const piv = a[(lo + hi) >> 1]; let i = lo, j = hi;
    while (i <= j) {
      while (a[i] < piv) i++;
      while (a[j] > piv) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return a[k];
  }
  return a[k];
}

// ---------- materiais e peças

const VARYING_MUNDO = ['#include <common>\nvarying vec3 vWPos;', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'];

// relevo leve do PET soprado: as faixas de luz ondulam um pouco em vez de serem retas de computador.
// Ruído de valor 3D: os valores da grade (hash3) ficam numa textura 32³ e o filtro trilinear da GPU faz a mesma
// interpolação suave que antes custava 8 hashes por chamada (ver texturaRuido)
const RUIDO_N = 32, RUIDO_BASE = 16;   // a textura cobre a grade de -16 a 15 (o shader usa de -9 a 9; o tempo dá a volta)
const GLSL_RUIDO = /* glsl */`
uniform highp sampler3D uRuido;
float ruido(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return texture(uRuido, (i + f + ${RUIDO_BASE + 0.5}) / ${RUIDO_N}.0).r;
}`;
function texturaRuido() {
  // o hash3 de antes, com aritmética de float32: hash3(p) = fract(q.x q.y q.z (q.x + q.y + q.z)), q = 17 fract(0,3183099 p + 0,1)
  const f = Math.fround, fr = (x) => f(x - Math.floor(x)), K = f(0.3183099), D = f(0.1);
  const q = (x) => f(fr(f(f(x * K) + D)) * 17);
  const dados = new Uint16Array(RUIDO_N ** 3);
  for (let z = 0; z < RUIDO_N; z++) for (let y = 0; y < RUIDO_N; y++) for (let x = 0; x < RUIDO_N; x++) {
    const a = q(x - RUIDO_BASE), b = q(y - RUIDO_BASE), c = q(z - RUIDO_BASE);
    dados[(z * RUIDO_N + y) * RUIDO_N + x] = THREE.DataUtils.toHalfFloat(fr(f(f(f(a * b) * c) * f(f(a + b) + c))));
  }
  const t = new THREE.Data3DTexture(dados, RUIDO_N, RUIDO_N, RUIDO_N);
  Object.assign(t, { format: THREE.RedFormat, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, wrapR: THREE.RepeatWrapping, generateMipmaps: false, unpackAlignment: 1 });
  t.needsUpdate = true;
  return t;
}

function materialReflexoPET(U, gotas, ior = 1.57) {
  // só o reflexo especular; o alfa = brilho do reflexo, então funciona sobre o canvas transparente
  // (ior: 1,57 do PET; o vidro provisório usa 1,52)
  const m = new THREE.MeshPhysicalMaterial({
    name: 'PET_reflexo', color: 0x000000, roughness: 0.03, metalness: 0, ior, specularIntensity: 1,
    envMapIntensity: 1.0, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  if (gotas) { m.normalMap = gotas; m.normalScale.set(0.75, 0.75); }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOrvalho = U.uOrvalho; sh.uniforms.uBottleInv = U.uBottleInv; sh.uniforms.uNivelGotas = U.uNivelGotas; sh.uniforms.uRuido = U.uRuido;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VARYING_MUNDO[0]).replace('#include <project_vertex>', VARYING_MUNDO[1]);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uOrvalho, uNivelGotas;\nuniform mat4 uBottleInv;\n' + GLSL_RUIDO)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec3 pLoc = (uBottleInv * vec4(vWPos, 1.0)).xyz;
        roughnessFactor = 0.025 + 0.045 * ruido(pLoc * 25.0 + 3.1);      // PET soprado: brilho quase uniforme, não perfeito`)
      .replace('#include <normal_fragment_maps>', `
        // ondulação de sopro (escala de 4 a 10 cm, < 1°): as faixas de luz tremem 1-2 px em vez de serem retas de CAD
        vec3 onda = vec3(ruido(pLoc * vec3(22.0, 9.0, 22.0)) - 0.5, 0.0, ruido(pLoc * vec3(22.0, 9.0, 22.0) + 7.3) - 0.5)
                  + 0.5 * vec3(ruido(pLoc * vec3(55.0, 20.0, 55.0) + 1.7) - 0.5, 0.0, ruido(pLoc * vec3(55.0, 20.0, 55.0) + 4.1) - 0.5);
        // linha de molde: as duas metades do molde se encontram no plano z = 0 (laterais), um fio quase invisível
        vec3 eixoX = vec3(uBottleInv[0][0], uBottleInv[1][0], uBottleInv[2][0]);   // eixos da garrafa no mundo
        vec3 eixoZ = vec3(uBottleInv[0][2], uBottleInv[1][2], uBottleInv[2][2]);
        float molde = (1.0 - smoothstep(0.0, 0.0006, abs(pLoc.z))) * sign(pLoc.z) * step(0.004, pLoc.y);
        vec3 pert = (viewMatrix * vec4((eixoX * onda.x + eixoZ * onda.z) * 0.018 + eixoZ * molde * 0.12, 0.0)).xyz;
        normal = normalize(normal + pert);
        #ifdef USE_NORMALMAP_TANGENTSPACE
          // gotas onde o suco gelado encostou (fixas no corpo, abaixo da linha de enchimento)
          float mascaraGotas = uOrvalho * (1.0 - smoothstep(-0.006, 0.0, pLoc.y - uNivelGotas));
          vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale * mascaraGotas;
          normal = normalize(tbn * mapN + pert);
        #endif`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
        gl_FragColor.a = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);`);
  };
  return m;
}

function materialBordaPET(U, gotas, gargalo) {
  // Vista de raspão, a parede do PET reflete o estúdio escuro: as laterais escurecem e o contorno fica definido.
  // Gargalo (PET grosso, injetado): faixa escura de refração antes da borda. Corpo: película de suco que escorreu
  // logo acima da linha de enchimento.
  return new THREE.ShaderMaterial({
    name: 'PET_borda', transparent: true, depthWrite: false, side: THREE.FrontSide,
    defines: { ...(gotas ? { COM_GOTAS: '' } : {}), ...(gargalo ? { GARGALO: '' } : {}) },
    uniforms: {
      uCor: { value: new THREE.Color(0.012, 0.004, 0.0) }, uA1: { value: 0.72 },
      uGotas: { value: gotas }, uOrvalho: U.uOrvalho, uBottleInv: U.uBottleInv, uNivelGotas: U.uNivelGotas,
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = -mv.xyz;
        #ifdef COM_GOTAS
          vUv = uv;
        #endif
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCor; uniform float uA1, uOrvalho, uNivelGotas; uniform sampler2D uGotas; uniform mat4 uBottleInv;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vWPos;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = uA1 * pow(f, 2.6);
        vec3 pLoc = (uBottleInv * vec4(vWPos, 1.0)).xyz;
        #ifdef GARGALO
          a = max(a, 0.42 * smoothstep(0.5, 0.62, f) * (1.0 - smoothstep(0.78, 0.9, f)));
        #endif
        #ifdef COM_GOTAS
          vec4 g = texture2D(uGotas, vUv);
          float m = uOrvalho * (1.0 - smoothstep(-0.006, 0.0, pLoc.y - uNivelGotas));
          // cada gota é uma lente: aro fino escuro (refrata o estúdio preto), mais forte do lado oposto à luz
          vec2 d = g.xy * 2.0 - 1.0;
          float incl = length(d);
          a += m * smoothstep(0.5, 0.85, incl) * (0.1 + 0.16 * smoothstep(-0.3, 0.6, d.x / max(incl, 1e-3)));
        #endif
        vec3 cor = uCor;
        #ifndef GARGALO
          // logo acima do nível: película do suco que molhou a parede ao encher (laranja escuro, some em ~4 mm)
          float acima = pLoc.y - uNivelGotas;
          float pel = uOrvalho * step(0.0, acima) * exp(-acima / 0.0035) * 0.16;
          cor = mix(cor, vec3(0.16, 0.05, 0.006), pel / max(a + pel, 1e-4));
          a = a + pel * (1.0 - a);
        #endif
        gl_FragColor = vec4(cor, clamp(a, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const GLSL_LIQ = /* glsl */`
varying vec3 vWPos;
uniform vec3 uN, uP0, uT1, uT2, uNLoc, uP0Loc;
uniform float uSpin, uRipple, uTime, uFoam, uChaveD;
uniform mat4 uBottleInv;
uniform vec2 uPerfil[PERFIL_N];       // (raio, expoente) do volume interno por altura
uniform vec2 uPerfilY;                // altura da primeira e da última amostra
uniform vec3 uChaveP;
${GLSL_RUIDO}
// cor do suco integral pela luz que chega (medida em fotos em fundo preto): sem luz -> quina escura; sombra; miolo;
// lado da luz. A saturação se mantém na sombra (não acinzenta) e o máximo fica abaixo de onde o tone mapping clareia
vec3 rampaSuco(float e) {
  vec3 c0 = vec3(0.027, 0.0052, 0.0006);   // #2E1002
  vec3 c1 = vec3(0.352, 0.064, 0.0012);    // #A04804
  vec3 c2 = vec3(0.716, 0.188, 0.005);     // #DC7810
  vec3 c3 = vec3(0.871, 0.305, 0.024);     // #F0962A
  vec3 c4 = vec3(0.95, 0.40, 0.055);
  if (e < 0.35) return mix(c0, c1, e / 0.35);
  if (e < 0.7) return mix(c1, c2, (e - 0.35) / 0.35);
  if (e < 1.0) return mix(c2, c3, (e - 0.7) / 0.3);
  return mix(c3, c4, clamp((e - 1.0) / 0.5, 0.0, 1.0));
}
// altura da superfície (acima do plano de nível) em coordenadas do próprio plano
float alturaSup(vec2 q) {
  float r2 = dot(q, q), r = sqrt(r2);
  float h = uSpin * (r2 - 0.00045);
  h += uRipple * (sin(r * 820.0 - uTime * 16.0) * exp(-r * 45.0)
                + 0.6 * sin(q.x * 430.0 + uTime * 9.0) * sin(q.y * 390.0 - uTime * 7.3));
  return h;
}
vec2 perfilEm(float y) {
  float f = clamp((y - uPerfilY.x) / (uPerfilY.y - uPerfilY.x), 0.0, 1.0) * float(PERFIL_N - 1);
  int i = int(floor(f)); int j = min(i + 1, PERFIL_N - 1);
  return mix(uPerfil[i], uPerfil[j], fract(f));
}
float rhoSE(vec2 q, float n) { vec2 a = abs(q) + 1e-7; return pow(pow(a.x, n) + pow(a.y, n), 1.0 / n); }
// quanto suco o raio de visão atravessa a partir deste ponto da parede (m): saída pela parede oposta (superelipse
// na altura do ponto), pelo fundo ou pela superfície do suco, o que vier primeiro
float espessura(vec3 p, vec3 d) {
  vec2 pr = perfilEm(p.y);
  float tMax = 0.2, l = length(d.xz);
  if (l > 1e-3) {
    // rhoSE(q) < r  <=>  |qx|^n + |qz|^n < r^n: a mesma bissecção com uma potência a menos por passo
    float lo = 0.0, hi = 2.6 * pr.x / l, rn = pow(pr.x, pr.y);
    for (int i = 0; i < 10; i++) {
      float m = 0.5 * (lo + hi); vec2 a = abs(p.xz + d.xz * m) + 1e-7;
      if (pow(a.x, pr.y) + pow(a.y, pr.y) < rn) lo = m; else hi = m;
    }
    tMax = lo;
  }
  if (d.y < -1e-4) tMax = min(tMax, (p.y - uPerfilY.x) / -d.y);
  float sd = dot(d, uNLoc);
  if (sd > 1e-4) tMax = min(tMax, max(-dot(p - uP0Loc, uNLoc), 0.0) / sd);
  return max(tMax, 0.0);
}`;

function materialLiquido(U) {
  // Suco integral é turvo: não se vê através dele, a cor vem da luz que entra e volta espalhada (refletância, não
  // brilho próprio). Nada de emissivo nem de halo: o lado perto da luz é laranja claro, o miolo laranja, a sombra
  // continua saturada e as quinas escurecem. O brilho do PET por cima vem da outra camada.
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, side: THREE.DoubleSide });
  m.name = 'Suco_laranja';
  m.defines = { PERFIL_N: 48 };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VARYING_MUNDO[0]).replace('#include <project_vertex>', VARYING_MUNDO[1]);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_LIQ)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec3 dSup = vWPos - uP0;
        vec2 qSup = vec2(dot(dSup, uT1), dot(dSup, uT2));
        float profund = alturaSup(qSup) - dot(dSup, uN);
        if (profund < 0.0) discard;
        vec3 pLoc = (uBottleInv * vec4(vWPos, 1.0)).xyz;
        float espuma;
        if (gl_FrontFacing) espuma = (1.0 - smoothstep(0.0, 0.0035, profund)) * uFoam;
        else {
          // a face de trás está na parede oposta: o ponto da superfície é onde o raio de visão cruza o plano do nível
          vec3 dV = normalize(vWPos - cameraPosition); float den = dot(dV, uN); den = abs(den) < 1e-4 ? -1e-4 : den;
          vec3 pS = vWPos + dV * (dot(uP0 - vWPos, uN) / den);
          vec2 qS = vec2(dot(pS - uP0, uT1), dot(pS - uP0, uT2));
          vec3 pSL = (uBottleInv * vec4(pS, 1.0)).xyz; vec2 pfE = perfilEm(pSL.y);
          // espuma junta na parede e onde o filete cai; no meio aparece o suco brilhante
          float junto = max(1.0 - smoothstep(0.0, 0.007, pfE.x - rhoSE(pSL.xz, pfE.y)), 1.0 - smoothstep(0.0, 0.012, length(qS)));
          float bolhas = ruido(vec3(qS * 420.0, uTime * 0.8)) * (0.6 + 0.4 * ruido(vec3(qS * 1400.0, uTime * 1.3)));
          espuma = uFoam * (0.2 + 0.8 * junto) * (0.45 + 0.55 * bolhas);
        }
        espuma = clamp(espuma, 0.0, 1.0);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (!gl_FrontFacing) roughnessFactor = mix(0.05, 0.5, espuma);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        if (!gl_FrontFacing) {
          // face de trás vista pelo corte = superfície do suco, com a normal da superfície
          float e = 0.0006;
          float hx = alturaSup(qSup + vec2(e, 0.0)) - alturaSup(qSup - vec2(e, 0.0));
          float hz = alturaSup(qSup + vec2(0.0, e)) - alturaSup(qSup - vec2(0.0, e));
          vec3 nSup = normalize(uN - uT1 * hx / (2.0 * e) - uT2 * hz / (2.0 * e));
          normal = normalize((viewMatrix * vec4(nSup, 0.0)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 nW = normalize(inverseTransformDirection(normal, viewMatrix));
          vec3 dW = normalize(vWPos - cameraPosition);
          float ndv = clamp(-dot(nW, dW), 0.0, 1.0);
          // luz principal: softbox grande e perto (frente-esquerda, acima). Difusa embrulhada (o suco espalha luz por
          // dentro) e caindo com a distância: o lado perto da luz fica mais claro, como na foto de estúdio
          vec3 Lp = uChaveP - vWPos; float dl = length(Lp);
          float nl = dot(nW, Lp / dl);
          float E = 0.95 * clamp((nl + 0.3) / 1.3, 0.0, 1.0) * pow(uChaveD / dl, 2.0);
          E += 0.12 * clamp((dot(nW, vec3(0.92, 0.12, 0.37)) + 0.2) / 1.2, 0.0, 1.0);  // rebatedor fraco à direita
          E += 0.12 * clamp(nW.y, 0.0, 1.0);                                              // teto
          // as duas faixas atrás (az ±158°) também iluminam o suco pelas laterais
          const vec3 FX_E = vec3(-0.373, 0.105, -0.922), FX_D = vec3(0.373, 0.105, -0.922);
          E += 0.30 * clamp((dot(nW, FX_E) + 0.25) / 1.25, 0.0, 1.0) + 0.18 * clamp((dot(nW, FX_D) + 0.25) / 1.25, 0.0, 1.0);
          vec3 cor;
          if (gl_FrontFacing) {
            // suco sobre fundo preto: onde a camada é fina (quinas, bordas) volta menos luz espalhada -> mais escuro e saturado
            vec3 dL = normalize((uBottleInv * vec4(dW, 0.0)).xyz);
            float mm = espessura(pLoc, dL) * 1000.0;
            E *= mix(0.4, 1.0, smoothstep(1.5, 12.0, mm));
            cor = rampaSuco(E);
            // contraluz: onde o suco é fino (quinas de trás, contorno), a luz das faixas atravessa e sai âmbar saturado
            float fino = 1.0 - smoothstep(3.0, 40.0, mm);
            float contraLuz = max(dot(dW, FX_E), 0.0) + 0.6 * max(dot(dW, FX_D), 0.0);
            cor += vec3(0.42, 0.095, 0.002) * fino * contraLuz;
            // variação lenta da polpa (escala de 3 cm, ±3%): nada de grão fino
            cor *= 0.97 + 0.06 * ruido(pLoc * 33.0);
            // linha do nível: risco fino e claro onde a superfície encosta na parede, só do lado da luz
            float ladoLuz = smoothstep(0.35, 0.85, E);
            cor += vec3(1.0, 0.54, 0.2) * 0.5 * exp(-profund * 2600.0) * ladoLuz;
          } else {
            // superfície vista de cima: suco turvo é laranja; de raspão o Fresnel troca a cor pelo reflexo do estúdio preto
            float fr = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
            cor = rampaSuco(E * 0.8) * (1.0 - fr);
          }
          vec3 corEspuma = vec3(0.93, 0.56, 0.17) * (0.55 + 0.45 * clamp(E, 0.0, 1.0));
          cor = mix(cor, corEspuma, espuma * 0.9);
          outgoingLight = min(cor, vec3(1.1)) + totalSpecular * (gl_FrontFacing ? 0.0 : 1.0);
        }
        #include <opaque_fragment>`);
  };
  return m;
}

// ---------- vidro

function materialReflexoVidro(U) {
  // como o reflexo da PET (alfa = brilho refletido, funciona sobre o canvas transparente), com ior 1,52 e o vidro
  // moldado: mais liso que o PET soprado, uma ondulação leve de molde e as duas linhas de molde (plano z = 0, por fora)
  const m = new THREE.MeshPhysicalMaterial({
    name: 'Vidro_reflexo', color: 0x000000, roughness: 0.02, metalness: 0, ior: 1.52, specularIntensity: 1,
    envMapIntensity: 1.0, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBottleInv = U.uBottleInv; sh.uniforms.uRuido = U.uRuido;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', VARYING_MUNDO[0]).replace('#include <project_vertex>', VARYING_MUNDO[1]);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform mat4 uBottleInv;\n' + GLSL_RUIDO)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        vec3 pLoc = (uBottleInv * vec4(vWPos, 1.0)).xyz;
        roughnessFactor = 0.012 + 0.02 * ruido(pLoc * 25.0 + 3.1);`)
      .replace('#include <normal_fragment_maps>', `
        // vidro de molde: ondulação mais larga e mais fraca que a do PET (os filetes ficam quase retos)
        vec3 onda = vec3(ruido(pLoc * vec3(16.0, 6.0, 16.0)) - 0.5, 0.0, ruido(pLoc * vec3(16.0, 6.0, 16.0) + 7.3) - 0.5);
        vec3 eixoX = vec3(uBottleInv[0][0], uBottleInv[1][0], uBottleInv[2][0]);
        vec3 eixoZ = vec3(uBottleInv[0][2], uBottleInv[1][2], uBottleInv[2][2]);
        // linhas de molde em x = ±R: um fio de 0,7 mm que pega um risco de luz (só na face de fora, acima do talão)
        float fora = step(0.0305, length(pLoc.xz)) * step(0.006, pLoc.y) * step(pLoc.y, 0.2);
        float molde = (1.0 - smoothstep(0.0, 0.00035, abs(pLoc.z))) * sign(pLoc.z) * fora;
        vec3 pert = (viewMatrix * vec4((eixoX * onda.x + eixoZ * onda.z) * 0.009 + eixoZ * molde * 0.35, 0.0)).xyz;
        normal = normalize(normal + pert);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 1.0);
        gl_FragColor.a = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b);`);
  };
  return m;
}

function materialBordaVidro(U, uComSuco) {
  // Parede de 2,6 mm (4,4 no gargalo) vista de raspão: o raio refrata, reflete por dentro e acha o estúdio preto ->
  // faixa escura antes do contorno, verde onde o vidro é grosso (gargalo, base). Na beirada, a luz das faixas de trás
  // atravessa a parede e sai num filete esverdeado. Faces de dentro (normal para a cavidade): a mesma coisa, mais fraca,
  // a segunda linha que se vê no espaço vazio acima do suco. Base grossa: lente, anel claro com o laranja do suco.
  // Saída pré-multiplicada: escurece o que está atrás e soma a luz que atravessa.
  return new THREE.ShaderMaterial({
    name: 'Vidro_borda', transparent: true, depthWrite: false, side: THREE.FrontSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uBottleInv: U.uBottleInv, uComSuco },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vWPos; varying vec3 vNW;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = -mv.xyz;
        vNW = normalize(mat3(modelMatrix) * normal);
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform mat4 uBottleInv; uniform float uComSuco;
      varying vec3 vN; varying vec3 vV; varying vec3 vWPos; varying vec3 vNW;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        vec3 pLoc = (uBottleInv * vec4(vWPos, 1.0)).xyz;
        vec3 nW = normalize(vNW), nL = mat3(uBottleInv) * nW;
        float r = length(pLoc.xz);
        float dentro = step(dot(nL.xz, pLoc.xz), 0.0) * step(0.009, pLoc.y);
        // faixa escura da parede grossa + Fresnel do contorno
        float faixa = smoothstep(0.5, 0.68, f) * (1.0 - smoothstep(0.9, 0.985, f));
        float a = 0.6 * pow(f, 2.6) + 0.34 * faixa;
        // espessura: gargalo e base são mais grossos -> o verde do vidro aparece
        float grosso = clamp(smoothstep(0.026, 0.017, r) + 1.0 - smoothstep(0.004, 0.01, pLoc.y), 0.0, 1.0);
        vec3 cor = mix(vec3(0.010, 0.014, 0.012), vec3(0.004, 0.030, 0.019), 0.25 + 0.75 * grosso);
        // filete de luz das faixas de trás atravessando a beirada (a esquerda, mais forte, como as faixas)
        float lado = max(-nW.x, 0.0) + 0.6 * max(nW.x, 0.0);
        float filete = smoothstep(0.8, 0.93, f) * (1.0 - smoothstep(0.965, 0.995, f)) * lado;
        vec3 luz = vec3(0.30, 0.44, 0.36) * filete * (0.6 + 0.6 * grosso);
        // base grossa (7 mm, fundo empurrado): lente sob o suco, faixa escura esverdeada com um anel claro laranja
        float base = (1.0 - dentro) * (1.0 - smoothstep(0.006, 0.0095, pLoc.y));
        float anel = smoothstep(0.0012, 0.0028, pLoc.y) * (1.0 - smoothstep(0.0042, 0.0062, pLoc.y));
        luz += base * uComSuco * (vec3(0.36, 0.085, 0.006) * anel + vec3(0.07, 0.016, 0.001));
        luz += base * vec3(0.02, 0.05, 0.035) * anel;
        a = mix(a, max(a, 0.5 - 0.25 * anel), base);
        // face de dentro: segunda linha, mais fraca
        a *= 1.0 - 0.55 * dentro; luz *= 1.0 - 0.5 * dentro;
        a = clamp(a, 0.0, 1.0);
        gl_FragColor = vec4(cor * a + luz, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// o suco cheio atrás da parede grossa: um cilindro de vidro cheio de líquido amplia o que está dentro (raio aparente
// ~ n·r, limitado pela face de fora), então o suco chega quase à face de fora em vez de parecer encolhido. Só a posição
// na tela muda (gl_Position); vWPos continua o ponto de verdade, então o corte no nível, a espuma e a espessura do
// suco (o volume simulado) não mudam em nada
function lenteNoSuco(m) {
  const antes = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    antes(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uBottleInv; uniform vec2 uPerfil[PERFIL_N]; uniform vec2 uPerfilY;`)
      .replace('vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;', `vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        {
          vec3 pL = (uBottleInv * vec4(vWPos, 1.0)).xyz;
          float f = clamp((pL.y - uPerfilY.x) / (uPerfilY.y - uPerfilY.x), 0.0, 1.0) * float(PERFIL_N - 1);
          int i = int(floor(f)); int j = min(i + 1, PERFIL_N - 1);
          float rIn = max(mix(uPerfil[i].x, uPerfil[j].x, fract(f)), 0.004);
          float parede = mix(0.0026, 0.0042, smoothstep(0.024, 0.0145, rIn));   // corpo 2,6 mm; gargalo ~4,4
          float esc = (rIn + parede - 0.00045) / rIn;                           // até 0,45 mm da face de fora
          vec3 dL = vec3(pL.x, 0.0, pL.z) * (esc - 1.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(vWPos + transpose(mat3(uBottleInv)) * dL, 1.0);
        }`);
  };
}

// estúdio da tampa de inox: o mesmo estúdio + dois cartões altos e macios dos lados (esquerda mais forte, do lado da
// luz principal) e um rebatedor baixo na frente; com a escova vertical viram faixas suaves ao longo da tampa
function ambienteInox(renderer) {
  const s = estudio();
  const cartao = (w, h, intensidade, az, el) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf6f4f0).multiplyScalar(intensidade), side: THREE.DoubleSide }));
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    p.position.set(Math.sin(a) * Math.cos(e) * 3, Math.sin(e) * 3, Math.cos(a) * Math.cos(e) * 3);
    p.lookAt(0, 0, 0); s.add(p);
  };
  cartao(0.9, 3.2, 2.4, -62, 4);
  cartao(0.7, 3.2, 1.0, 70, 4);
  cartao(2.4, 0.5, 0.12, 0, -12);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(s, 0).texture;
  pm.dispose();
  s.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
  return t;
}

// fita de poliéster cinza tecida (sarja 2/2, ourelas mais escuras): cor e relevo feitos num canvas. u atravessa a fita
// (16 fios de urdume), v vai ao longo dela
function texturaFita(maxAniso) {
  const W = 32, H = 64;
  const tela = (w, h) => (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const alt = new Float32Array(W * H), tom = new Float32Array(W * H);
  let s = 7; const acaso = () => ((s = (s * 16807) % 2147483647) / 2147483647);   // fixo: não mexe no Math.random da página
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fio = x >> 1, lin = y >> 1, emCima = ((fio + lin) & 3) < 2;     // urdume por cima em 2 de 4 tramas: diagonal
    const fx = ((x & 1) + 0.5) / 2, fy = ((y & 1) + 0.5) / 2;
    const k = y * W + x;
    alt[k] = emCima ? 0.6 + 0.4 * Math.sin(Math.PI * fx) : 0.2 + 0.4 * Math.sin(Math.PI * fy);
    const ourela = fio < 2 || fio > 13;
    tom[k] = (emCima ? 0.6 : 0.5) * (ourela ? 0.72 : 1) * (0.94 + 0.12 * acaso()) * (0.75 + 0.25 * alt[k]);
  }
  const cc = tela(W, H), cn = tela(W, H);
  const gc = cc.getContext('2d'), gn = cn.getContext('2d');
  const ic = gc.createImageData(W, H), inn = gn.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, i = k * 4;
    const v = Math.round(255 * Math.min(tom[k], 1));
    ic.data[i] = ic.data[i + 1] = ic.data[i + 2] = v; ic.data[i + 3] = 255;
    const dx = alt[y * W + ((x + 1) % W)] - alt[y * W + ((x + W - 1) % W)];
    const dy = alt[((y + 1) % H) * W + x] - alt[((y + H - 1) % H) * W + x];
    const n = new THREE.Vector3(-dx * 1.2, dy * 1.2, 1).normalize();
    inn.data[i] = Math.round(127.5 + 127.5 * n.x); inn.data[i + 1] = Math.round(127.5 + 127.5 * n.y);
    inn.data[i + 2] = Math.round(127.5 + 127.5 * n.z); inn.data[i + 3] = 255;
  }
  gc.putImageData(ic, 0, 0); gn.putImageData(inn, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    Object.assign(t, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: maxAniso });
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(cc, true), normalMap: tex(cn, false) };
}

// Alça de tecido: laço preso no rebite (as duas pontas em extras.alca.ancora, tampa fechada). Corrente de verlet no
// mundo (gravidade de verdade, de cabeça para baixo ela pende para o outro lado), distâncias fixas (fita não estica),
// um pouco de rigidez de dobra, amortecimento de ar e colisão simples com a tampa, o ombro/corpo e o piso. A fita é
// uma malha de N x 2 vértices reescrita no lugar a cada quadro (um só buffer intercalado: posição + normal)
function criarAlca(g, tampa, maxAniso) {
  const x = g.extras.alca ?? {}, N = 20;
  const L = x.comprimento ?? 0.18, larg = x.largura ?? 0.0042, seg = L / (N - 1);
  const anc = new THREE.Vector3().fromArray(x.ancora ?? [0, g.altura, 0]);
  // as duas pontas saem do rebite para cima, paralelas: o 1º segmento de cada lado é guiado (fixo na tampa)
  const pinos = [new THREE.Vector3(-0.0011, -0.0007, 0), new THREE.Vector3(-0.0011, seg - 0.0007, 0),
    new THREE.Vector3(0.0011, seg - 0.0007, 0), new THREE.Vector3(0.0011, -0.0007, 0)].map((d) => d.add(anc));
  const PINO_I = [0, 1, N - 2, N - 1], fixo = (i) => i < 2 || i > N - 3;
  const H = 1 / 240, ITER = 10, FOLGA = 0.0007, RIGIDEZ = 0.05;           // passo fixo da simulação, iterações, meia espessura + folga
  const DAMP = Math.exp(-2.2 * H), GRAV = -9.81 * H * H;

  // tampa no espaço da tampa (fechada = espaço da garrafa): raio, topo e base
  tampa.updateWorldMatrix(true, true);
  const caixa = new THREE.Box3();
  for (const o of tampa.children) if (o.isMesh) caixa.expandByObject(o);
  caixa.applyMatrix4(new THREE.Matrix4().copy(tampa.matrixWorld).invert());
  const rTampa = Math.max(caixa.max.x, -caixa.min.x, caixa.max.z, -caixa.min.z), topo = caixa.max.y - 0.0006, pe = caixa.min.y;
  // raio de fora da garrafa por altura: perfil interno + parede (só a parte da parede, subindo)
  const perfil = (g.extras.perfilSuco ?? []).filter((p) => p[0] > 0.001);
  const raioFora = (y) => {
    if (!perfil.length) return g.raioQuina;
    let i = 0; while (i < perfil.length - 2 && perfil[i + 1][1] < y) i++;
    const [r0, y0] = perfil[i], [r1, y1] = perfil[i + 1], t = clamp01((y - y0) / Math.max(y1 - y0, 1e-6));
    const r = r0 + (r1 - r0) * t;
    return r + (r < 0.02 ? 0.0042 : 0.0026);
  };

  const p = new Float64Array(N * 3), q = new Float64Array(N * 3);    // posição atual e anterior (mundo)
  const loc = new Float64Array(N * 3), locAnt = new Float64Array(N * 3);   // no espaço da tampa (malha e repouso)
  const pinoMundo = pinos.map(() => new THREE.Vector3()), pinoAnt = pinos.map(() => new THREE.Vector3());
  const mT = new THREE.Matrix4(), mTInv = new THREE.Matrix4(), mGInv = new THREE.Matrix4(), v = new THREE.Vector3();
  let iniciada = false, resto = 0;

  // malha: 2 vértices por ponto, posição + normal num só buffer; uv fixo (u atravessa, v ao longo, ~2 larguras por ladrilho)
  const dados = new Float32Array(N * 2 * 6), buf = new THREE.InterleavedBuffer(dados, 6).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0));
  geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(buf, 3, 3));
  const uv = new Float32Array(N * 4), idx = [];
  for (let i = 0; i < N; i++) {
    const vv = i * seg / (2 * larg);
    uv.set([0, vv, 1, vv], i * 4);
    if (i < N - 1) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const { map, normalMap } = texturaFita(maxAniso);
  const mat = new THREE.MeshPhysicalMaterial({ name: 'Alca_tecido', color: new THREE.Color('#e4e4e4'), map, normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.86, metalness: 0, sheen: 0.6, sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#9a9a9a'), envMapIntensity: 1.6, side: THREE.DoubleSide });
  const malha = new THREE.Mesh(geo, mat);
  malha.frustumCulled = false;   // a fita muda de forma a cada quadro
  malha.renderOrder = 0;

  function lerPinos() {
    mT.copy(tampa.matrixWorld);
    for (let k = 0; k < 4; k++) { pinoAnt[k].copy(pinoMundo[k]); pinoMundo[k].copy(pinos[k]).applyMatrix4(mT); }
  }
  function colidir(i) {
    v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    // tampa (cilindro com topo)
    v.applyMatrix4(mTInv);
    let r = Math.hypot(v.x, v.z), mexeu = false;
    if (v.y < topo + FOLGA && v.y > pe - 0.003 && r < rTampa + FOLGA) {
      if (topo + FOLGA - v.y < rTampa + FOLGA - r) v.y = topo + FOLGA;
      else { const s = (rTampa + FOLGA) / Math.max(r, 1e-6); v.x = r > 1e-6 ? v.x * s : rTampa + FOLGA; v.z *= s; }
      mexeu = true;
    }
    if (mexeu) { v.applyMatrix4(mT); p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); }
    else v.applyMatrix4(mT);
    // garrafa (ombro e corpo), no espaço da garrafa
    v.applyMatrix4(mGInv); r = Math.hypot(v.x, v.z); mexeu = false;
    if (v.y > -0.002 && v.y < pe) {
      const rf = raioFora(v.y) + FOLGA;
      if (r < rf) { const s = rf / Math.max(r, 1e-6); v.x = r > 1e-6 ? v.x * s : rf; v.z *= s; mexeu = true; }
    }
    if (mexeu) { v.applyMatrix4(g.garrafa.matrixWorld); p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; }
    if (p[i * 3 + 1] < FOLGA) p[i * 3 + 1] = FOLGA;   // piso
  }
  function passoFixo(f) {
    // pinos: entre a posição do quadro anterior e a deste (f de 0 a 1), sem trancos com passos grandes
    for (let k = 0; k < 4; k++) {
      const i = PINO_I[k];
      v.lerpVectors(pinoAnt[k], pinoMundo[k], f);
      p[i * 3] = q[i * 3] = v.x; p[i * 3 + 1] = q[i * 3 + 1] = v.y; p[i * 3 + 2] = q[i * 3 + 2] = v.z;
    }
    for (let i = 2; i < N - 2; i++) for (let c = 0; c < 3; c++) {
      const k = i * 3 + c, ant = p[k];
      p[k] += (p[k] - q[k]) * DAMP + (c === 1 ? GRAV : 0);
      q[k] = ant;
    }
    for (let it = 0; it < ITER; it++) {
      // distâncias fixas entre vizinhos; dobra: a fita tecida é firme, de dois em dois prefere a curva de um laço
      // redondo (1,97 segmento), com pouca força: o peso ainda a deita para o lado
      for (let i = 0; i < N - 1; i++) restringir(i, i + 1, seg, 1);
      for (let i = 0; i < N - 2; i++) restringir(i, i + 2, 1.97 * seg, RIGIDEZ);
      if (it % 3 === 2 || it === ITER - 1) for (let i = 2; i < N - 2; i++) colidir(i);
    }
  }
  function restringir(a, b, d0, forca) {   // forca 1: distância exata; < 1: mola (dobra)
    const ia = a * 3, ib = b * 3;
    const dx = p[ib] - p[ia], dy = p[ib + 1] - p[ia + 1], dz = p[ib + 2] - p[ia + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    const wa = fixo(a) ? 0 : 1, wb = fixo(b) ? 0 : 1;
    if (!(wa + wb)) return;
    const k = (d - d0) / d / (wa + wb) * forca;
    p[ia] += dx * k * wa; p[ia + 1] += dy * k * wa; p[ia + 2] += dz * k * wa;
    p[ib] -= dx * k * wb; p[ib + 1] -= dy * k * wb; p[ib + 2] -= dz * k * wb;
  }
  function iniciar() {
    // laço de perímetro L no plano x-y da tampa, saindo do rebite para a esquerda (lado da luz principal); assenta 2 s
    const R0 = L / (2 * Math.PI);
    for (let i = 0; i < N; i++) {
      const a = (i / (N - 1)) * 2 * Math.PI;
      v.set(anc.x - R0 * Math.sin(a), anc.y + R0 * (1 - Math.cos(a)), anc.z).applyMatrix4(mT);
      p[i * 3] = q[i * 3] = v.x; p[i * 3 + 1] = q[i * 3 + 1] = v.y; p[i * 3 + 2] = q[i * 3 + 2] = v.z;
    }
    for (let k = 0; k < 4; k++) pinoAnt[k].copy(pinoMundo[k]);
    for (let s = 0; s < 480; s++) passoFixo(1);
  }
  function escrever() {
    for (let i = 0; i < N; i++) {
      v.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]).applyMatrix4(mTInv);
      locAnt[i * 3] = loc[i * 3]; locAnt[i * 3 + 1] = loc[i * 3 + 1]; locAnt[i * 3 + 2] = loc[i * 3 + 2];
      loc[i * 3] = v.x; loc[i * 3 + 1] = v.y; loc[i * 3 + 2] = v.z;
    }
    for (let i = 0; i < N; i++) {
      const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, N - 1) * 3;
      let tx = loc[b] - loc[a], ty = loc[b + 1] - loc[a + 1], tz = loc[b + 2] - loc[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // largura: o eixo z da tampa (perpendicular ao plano do laço), tirada a parte ao longo da fita
      let wx = -tz * tx, wy = -tz * ty, wz = 1 - tz * tz;
      const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
      const nx = ty * wz - tz * wy, ny = tz * wx - tx * wz, nz = tx * wy - ty * wx;
      const h = larg / 2, o = i * 12, c = i * 3;
      dados[o] = loc[c] - wx * h; dados[o + 1] = loc[c + 1] - wy * h; dados[o + 2] = loc[c + 2] - wz * h;
      dados[o + 3] = nx; dados[o + 4] = ny; dados[o + 5] = nz;
      dados[o + 6] = loc[c] + wx * h; dados[o + 7] = loc[c + 1] + wy * h; dados[o + 8] = loc[c + 2] + wz * h;
      dados[o + 9] = nx; dados[o + 10] = ny; dados[o + 11] = nz;
    }
    buf.needsUpdate = true;
  }

  const alca = {
    malha, quieta: false, custo: 0,
    passo(dt) {
      const t0 = performance.now();
      lerPinos();
      mTInv.copy(mT).invert(); mGInv.copy(g.garrafa.matrixWorld).invert();
      if (!iniciada) { iniciada = true; iniciar(); escrever(); escrever(); }
      // salto da tampa (reiniciar, troca de modo): leva a fita junto, sem chicotada
      const salto = pinoMundo[0].distanceTo(pinoAnt[0]);
      if (salto > 0.03) {
        v.subVectors(pinoMundo[0], pinoAnt[0]);
        for (let i = 0; i < N; i++) { p[i * 3] += v.x; p[i * 3 + 1] += v.y; p[i * 3 + 2] += v.z; q[i * 3] += v.x; q[i * 3 + 1] += v.y; q[i * 3 + 2] += v.z; }
        for (let k = 0; k < 4; k++) pinoAnt[k].copy(pinoMundo[k]);
      }
      // parada: pinos parados e a fita sem velocidade -> não simula nem reescreve (o quadro pode ser pulado)
      if (alca.quieta && salto < 1e-7) {
        let vel = 0;
        for (let i = 0; i < N * 3; i++) vel = Math.max(vel, Math.abs(p[i] - q[i]));
        if (vel < 1e-7) { alca.custo = performance.now() - t0; return; }
      }
      resto += Math.min(dt, 1 / 20);
      const n = Math.floor(resto / H); resto -= n * H;
      for (let s = 1; s <= n; s++) passoFixo(s / n);
      escrever();
      // quieta = parada em relação à tampa (o balanço lento leva a fita junto, quase rígida): < 6 mm/s, menos de
      // meio pixel por quadro a 30 quadros/s
      let mov = 0;
      for (let i = 0; i < N * 3; i++) mov = Math.max(mov, Math.abs(loc[i] - locAnt[i]));
      alca.quieta = mov < 0.006 * Math.max(dt, 1e-3);
      alca.custo = performance.now() - t0;
    },
    descartar() { map.dispose(); normalMap.dispose(); },
  };
  malha.userData.alca = alca;   // para medir (custo por quadro)
  return alca;
}

function criarJato(U) {
  const geo = new THREE.CylinderGeometry(0.0029, 0.0016, 1, 24, 96, true).translate(0, -0.5, 0);   // afina ao acelerar
  // filete de suco caindo: mesma cor da face iluminada da garrafa (o estúdio é preto, então a cor vem como emissiva)
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#3A1A04'), roughness: 0.03, ior: 1.34, specularIntensity: 1,
    envMapIntensity: 2.5, emissive: new THREE.Color('#E8851A'), emissiveIntensity: 0.6 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // liso perto da boca; as ondulações crescem conforme o filete cai (0 = topo, 1 = superfície)
        float yy = position.y, caiu = -yy;
        transformed.xz *= 1.0 + (0.015 + 0.11 * caiu * caiu) * sin(yy * 150.0 + uTime * 45.0);
        transformed.x += sin(yy * 23.0 + uTime * 17.0) * 0.0004 * caiu;
        transformed.z += cos(yy * 19.0 + uTime * 13.0) * 0.0003 * caiu;`);
  };
  const jato = new THREE.Mesh(geo, m);
  jato.renderOrder = 1;
  return jato;
}

// degradê na base do quadro: multiplica o que já foi desenhado (pré-multiplicado) por uma rampa vertical, igual a um
// mask-image: linear-gradient(to bottom, #000 de%, transparent ate%) no canvas. Só a faixa de baixo é desenhada.
function criarDesvanecer([de, ate]) {
  const geo = new THREE.BufferGeometry();
  const yTopo = 1 - 2 * de;   // em coordenadas de recorte (y = 1 no alto do canvas)
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, yTopo, 0, -1, -1, 0, 1, yTopo, 0, -1, yTopo, 0], 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uDe: { value: de }, uAte: { value: ate } },
    vertexShader: 'varying float vY; void main() { vY = 0.5 - 0.5 * position.y; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float uDe, uAte; varying float vY; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - clamp((uAte - vY) / (uAte - uDe), 0.0, 1.0)); }',
    depthTest: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const faixa = new THREE.Mesh(geo, m); faixa.frustumCulled = false;
  const cena = new THREE.Scene(); cena.add(faixa);
  return cena;
}

function sombraDeContato() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.4, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.75 }));
  m.position.y = 0.0003; m.renderOrder = -1;
  return m;
}// piso de acrílico preto: reflexo forte no contato (~30%, Fresnel de raspão) que esmaece e desfoca um pouco conforme
// a altura refletida, até sumir a 60% da altura da garrafa. Saída pré-multiplicada: o fundo da página aparece.
const SHADER_PISO = {
  name: 'PisoEspelhado',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uForca: { value: 0.32 }, uAltura: { value: 0.187 }, uCentro: { value: new THREE.Vector3(0, 0.0935, 0) }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    // segunda garrafa (NUM_GARRAFAS 2): centro e altura dela, e a meia largura de cada uma (m)
    uAlturaB: { value: 0.228 }, uCentroB: { value: new THREE.Vector3(0, 0.114, 0) }, uLargura: { value: 0.05 }, uLarguraB: { value: 0.05 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main() { vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uForca, uAltura; uniform vec3 uCentro; uniform vec2 uTexel;
    #if NUM_GARRAFAS > 1
      uniform float uAlturaB, uLargura, uLarguraB; uniform vec3 uCentroB;
    #endif
    varying vec4 vUv; varying vec3 vW;
    void main() {
      // altura do ponto refletido: o raio da câmera atravessa o piso e encontra o plano vertical da garrafa
      vec2 dc = vW.xz - cameraPosition.xz; float dP = length(dc);
      float dB = dot(uCentro.xz - cameraPosition.xz, dc / max(dP, 1e-5));
      float h = max(cameraPosition.y * (dB - dP) / max(dP, 1e-4), 0.0);
      float t = clamp(h / (0.6 * uAltura), 0.0, 1.0);
      #if NUM_GARRAFAS > 1
        // duas garrafas: o ponto reflete a que estiver mais perto da linha de visão, de lado (em meias larguras); a
        // altura é medida no plano dela (com uma pega à frente, o plano da outra daria a altura errada). Troca suave no vão
        vec2 dn = dc / max(dP, 1e-5), rA = uCentro.xz - cameraPosition.xz, rB = uCentroB.xz - cameraPosition.xz;
        float latA = abs(dn.x * rA.y - dn.y * rA.x) / uLargura, latB = abs(dn.x * rB.y - dn.y * rB.x) / uLarguraB;
        float hB = max(cameraPosition.y * (dot(rB, dn) - dP) / max(dP, 1e-4), 0.0);
        t = mix(t, clamp(hB / (0.6 * uAlturaB), 0.0, 1.0), smoothstep(-0.15, 0.15, latA - latB));
      #endif
      float esmaece = pow(1.0 - t, 1.2) * uForca;
      if (esmaece < 0.002) discard;
      vec2 uv = vUv.xy / vUv.w;
      float raio = 1.0 + 4.0 * t;                  // px do alvo (meia resolução): acrílico é espelho, desfoque pequeno
      vec4 base = texture2D(tDiffuse, uv);
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 12.0) * raio;
        base += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * uTexel);
      }
      base /= 13.0;
      gl_FragColor = vec4(base.rgb * esmaece, 1.0);        // Fresnel aplicado na luz linear, antes do tone mapping
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.a = max(base.a * esmaece, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)));
    }`,
};

// Estúdio de foto de produto em fundo preto (dark field), fixo no mundo: tudo preto menos três luzes.
// - softbox principal grande, frente-esquerda e alta (az -40°, el 40°), miolo mais forte caindo para a borda: brilho
//   no ombro e na tampa, sem véu nas faces do rótulo;
// - duas faixas estreitas quase atrás (az ±158°), uma mais forte que a outra: o filete que desenha cada contorno;
// - faixa fina no alto (el 75°): linha no topo da tampa e no ombro.
function estudio() {
  const s = new THREE.Scene();
  const sala = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.0012, 0.001, 0.0009), side: THREE.BackSide }));
  s.add(sala);
  const textura = (w, h, f) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = f(x / (w - 1) * 2 - 1, y / (h - 1) * 2 - 1), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * Math.min(Math.max(k, 0), 1)); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const sst = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  // faixa: miolo firme, laterais caindo em 15% da largura; pontas macias
  const texFaixa = textura(32, 256, (u, v) => sst(1, 0.7, Math.abs(u)) * sst(1, 0.8, Math.abs(v)));
  // softbox: queda radial do centro (1) para a borda (0,4), cantos arredondados
  const texSoft = textura(128, 128, (u, v) => {
    const r = Math.hypot(u, v * 0.9); return (1 - 0.6 * Math.min(r, 1) ** 1.5) * sst(1, 0.88, Math.max(Math.abs(u), Math.abs(v)));
  });
  const luz = (w, h, intensidade, az, el, tex, dist = 3, cor = 0xfbf8f4) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(cor).multiplyScalar(intensidade), side: THREE.DoubleSide }));
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    p.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    p.lookAt(0, 0, 0); s.add(p); return p;
  };
  luz(2.4, 2.4, 1.8, -40, 40, texSoft);                 // principal
  luz(0.5, 3.6, 6.0, -158, 6, texFaixa);                // faixa traseira esquerda (forte)
  luz(0.5, 3.6, 3.6, 158, 6, texFaixa);                 // faixa traseira direita (mais fraca: assimetria de foto)
  const teto = luz(0.3, 2.4, 4.0, 0, 75, texFaixa);     // faixa no alto, atravessada
  teto.rotateZ(Math.PI / 2);
  return s;
}
