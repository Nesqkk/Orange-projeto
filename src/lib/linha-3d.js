// Linha Orange em 3D: copo 473 ml e garrafa 600 ml com tampa deslizante, desenhados aqui (sem .glb).
// No React, importe com dynamic(..., { ssr: false }): o WebGL só existe no navegador.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LOGO_LARGURA, LOGO_PATHS } from './logo-orange.js';
const mm = (v) => v / 1000;
const tela = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const orm = (r, m) => `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`;
// Logo oficial (lib/logo-orange.js): caixa de largura s; a altura segue a proporção do logo (s2 estica na vertical).
const LOGO_P2D = LOGO_PATHS.map((d) => new Path2D(d));
function logo(k, x, y, s, cor, s2 = s) { k.save(); k.translate(x, y); k.scale(s / LOGO_LARGURA, s2 / LOGO_LARGURA); k.fillStyle = cor; LOGO_P2D.forEach((p) => k.fill(p)); k.restore(); }
function rnd(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
/* Logo na superfície curva: cada coluna é posta onde ela aparece vista de frente, então o logo não afina nas bordas. */
function logoCurvo(dst, cor, Lmm, rL, cxPx, cyPx, pxH, pxV) {
  const o = tela(Math.ceil(Lmm * pxV), Math.ceil(Lmm * pxV * 1.25)); logo(o.getContext('2d'), 0, 0, Lmm * pxV, cor);
  const half = Lmm / 2, sMax = rL * Math.asin(Math.min(.999, half / rL)), top = cyPx - Lmm * pxV * .62;
  for (let dx = Math.floor(-sMax * pxH); dx <= Math.ceil(sMax * pxH); dx++) {
    const sx = (rL * Math.sin(dx / pxH / rL) + half) * pxV;
    if (sx >= 0 && sx < o.width) dst.drawImage(o, sx, 0, 1, o.height, cxPx + dx, top, 1, o.height);
  }
}
export const CORES = {
  preto: { nome: 'Preto', base: '#151515', rug: .4, metal: 0, coat: .35, logo: '#E6E8EA', lr: .26, lm: .6 },
  prata: { nome: 'Prata', base: '#C9CDD1', rug: .3, metal: 1, coat: 0, logo: '#262728', lr: .55, lm: .2, escovado: true },
  osso: { nome: 'Osso', base: '#EAE3D6', rug: .25, metal: 0, coat: 1, logo: '#6E7276', lr: .3, lm: .6 },
  laranja: { nome: 'Laranja-sangue', base: '#B8400D', rug: .24, metal: 0, coat: 1, logo: '#F0F1F2', lr: .28, lm: .5 },
};
/* Dois produtos, mesma lógica: corpo pintado, aro de aço, tampa deslizante. A garrafa ganha alça. Medidas em mm. */
export const PRODUTOS = {
  copo: { titulo: 'Copo Orange 473 ml', lead: 'Inox com parede dupla a vácuo, aro de aço escovado e tampa deslizante. O logo vai grande, no centro, gravado a laser até aparecer o metal.',
    specs: [['Capacidade', '473 ml'], ['Medidas', 'Ø 88 mm em cima, Ø 63 mm na base, 15 cm'], ['Material', 'Inox 304, parede dupla a vácuo'], ['Tampa', 'Deslizante, fecha o bocal'], ['Base', 'Cabe no porta-copo do carro']],
    rTopo: 43, rBase: 31.5, corpoAte: 128, aro: 17, logo: 50, sombra: .16,
    angulos: [['Frente', [0, .088, .7], [0, .076, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0]], ['Tampa aberta', [0, .13, .95], [0, .1, 0], [0, -.15, -.45, .015], [-.03, .05, .015, .7, .3]],
      ['Três quartos', [0, .1, .66], [0, .074, 0], [0, -.62, 0, 0], [0, 0, 0, 0, 0]], ['Tampa de perto', [0, .42, .22], [0, .14, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0]]] },
  garrafa: { titulo: 'Garrafa Orange 600 ml', lead: 'Mesma tampa deslizante do copo, corpo reto e fino e uma alça que deita quando não está em uso. Logo grande no centro, gravado a laser.',
    specs: [['Capacidade', '600 ml'], ['Medidas', 'Ø 71 mm, 23,5 cm de altura'], ['Material', 'Inox 304, parede dupla a vácuo'], ['Tampa', 'Deslizante, a mesma do copo em tamanho menor'], ['Alça', 'Gira no aro e deita sobre o corpo']],
    rTopo: 35, rBase: 35, corpoAte: 212, aro: 18, logo: 58, sombra: .13, alca: true,
    angulos: [['Frente', [0, .13, 1], [0, .12, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0]], ['Tampa aberta', [0, .17, 1.2], [0, .14, 0], [0, -.2, -.4, .015], [-.03, .055, .015, .7, .3]],
      ['Três quartos', [0, .14, .95], [0, .118, 0], [0, -.62, 0, 0], [0, 0, 0, 0, 0]], ['Tampa de perto', [0, .55, .26], [0, .225, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0]]] },
};

/** Monta a vitrine 3D no canvas. opcoes: produto, cor, aoMiniaturas(lista de imagens), aoMudarAngulo(i). */
export function iniciarLinha(canvas, opcoes = {}) {
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
{ const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), new THREE.MeshBasicMaterial({ color: '#202020', side: THREE.BackSide })));
  const p = (w, h, k, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF').multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, .3, 0); s.add(m); };
  // luz difusa (painéis grandes e fracos): sem faixas fixas de reflexo no corpo
  // estúdio de foto de produto: softbox principal ao lado, dois filetes de luz atrás (contornam as bordas), teto suave e rebatedor fraco
  p(1.6, 2.6, 3.2, [-1.7, .9, .9]); p(.25, 2.4, 6, [-1.1, .7, -1.3]); p(.25, 2.4, 5, [1.2, .7, -1.2]); p(2.4, 2.4, 1, [0, 2.6, 0]); p(2, 1.2, .35, [1.6, .5, 1.2]);
  const g = new THREE.PMREMGenerator(renderer); scene.environment = g.fromScene(s, 0).texture; g.dispose(); }
scene.add(new THREE.HemisphereLight('#FFFFFF', '#DDDDDD', .35));
// Luz de contorno fria atrás, à direita: separa o preto do produto do fundo escuro.
{ const rim = new THREE.DirectionalLight('#d6e6ff', 1.6); rim.position.set(.7, .35, -.6); scene.add(rim); const rim2 = new THREE.DirectionalLight('#ffe2c8', .8); rim2.position.set(-.7, .3, -.5); scene.add(rim2); }
const sombra = (() => { const c = tela(256, 256), k = c.getContext('2d'), g = k.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.72)'); g.addColorStop(.4, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = g; k.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .0004; scene.add(m); return m; })();

const torno = (pts, seg = 200) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(mm(r), mm(y))), seg);
const ret = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
const tx = { col: new THREE.CanvasTexture(tela(4, 4)), rm: new THREE.CanvasTexture(tela(4, 4)) }; tx.col.colorSpace = THREE.SRGBColorSpace;
const M = {
  corpo: new THREE.MeshPhysicalMaterial({ map: tx.col, roughnessMap: tx.rm, metalnessMap: tx.rm, roughness: 1, metalness: 1, clearcoatRoughness: .24 }),
  casco: new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, clearcoatRoughness: .24 }),
  aco: new THREE.MeshPhysicalMaterial({ color: '#D8DBDE', metalness: 1, roughness: .24 }),
  dentro: new THREE.MeshPhysicalMaterial({ color: '#B4B8BC', metalness: 1, roughness: .32, side: THREE.BackSide }),
  fundo: new THREE.MeshPhysicalMaterial({ color: '#A9ADB1', metalness: 1, roughness: .35 }),
  tampa: new THREE.MeshPhysicalMaterial({ color: '#141414', roughness: .18, clearcoat: 1, clearcoatRoughness: .08, side: THREE.DoubleSide }),
  fosco: new THREE.MeshPhysicalMaterial({ color: '#1A1A1A', roughness: .6 }),
  fume: new THREE.MeshPhysicalMaterial({ color: '#3A3A3A', roughness: .08, transparent: true, opacity: .62, clearcoat: 1 }),
  breu: new THREE.MeshBasicMaterial({ color: '#050505' }),
};
const logoTampa = (() => { const c = tela(256, 256); logo(c.getContext('2d'), 48, 40, 160, '#0B0B0B'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshPhysicalMaterial({ map: t, transparent: true, roughness: .5 }); })();

let prod = opcoes.produto || 'copo', cor = opcoes.cor || 'preto', numero = opcoes.numero || 0, copo, tampa;
function montar() {
  if (copo) { scene.remove(copo); copo.traverse((o) => o.geometry?.dispose()); }
  const P = PRODUTOS[prod], rT = P.rTopo, rB = P.rBase, h = P.corpoAte, y1 = h + P.aro, rI = rT - 1.3, k = rI / 41.7;
  copo = new THREE.Group(); scene.add(copo);
  const add = (geo, mat, pai = copo) => { const m = new THREE.Mesh(geo, mat); pai.add(m); return m; };
  add(torno([[0, 0], [rB - 3, 0], [rB - .7, .8], [rB, 2.5], [rB, 4]]), M.casco);
  add(new THREE.CylinderGeometry(mm(rT), mm(rB), mm(h - 4), 240, 1, true, Math.PI), M.corpo).position.y = mm((h + 4) / 2);
  add(torno([[rT, h], [rT + .2, h + .4], [rT + .6, h + 1]]), M.aco);
  add(new THREE.CylinderGeometry(mm(rT + .7), mm(rT + .6), mm(P.aro - 1), 240, 1, true), M.aco).position.y = mm(h + 1 + (P.aro - 1) / 2);
  add(torno([[rT + .7, y1], [rT + .5, y1 + .9], [rT - .3, y1 + 1.4], [rI + .2, y1 + 1], [rI, y1]]), M.aco);
  add(new THREE.CylinderGeometry(mm(rI), mm(rB - 1.1), mm(y1 - 5), 160, 1, true), M.dentro).position.y = mm((y1 + 5) / 2);
  const f = add(new THREE.CircleGeometry(mm(rB - 1.1), 64), M.fundo); f.rotation.x = -Math.PI / 2; f.position.y = mm(5);
  // tampa deslizante (igual nos dois, escalada pelo diâmetro)
  tampa = new THREE.Group(); copo.add(tampa);
  add(torno([[-.4, -9], [-.3, .4], [.6, 1.3], [.8, 2.4], [.2, 3.3], [-1.4, 3.6], [-4.5, 3.3], [-5.3, 2.2], [-5.5, .6]].map(([dr, dy]) => [rI + dr, y1 + dy]).concat([[0, y1 + .6]]), 160), M.tampa, tampa);
  const d = new THREE.ExtrudeGeometry(ret(mm(30 * k), mm(36 * k), mm(8 * k)), { depth: mm(2.6), bevelEnabled: true, bevelThickness: mm(.8), bevelSize: mm(.8), bevelSegments: 4, curveSegments: 16 }); d.rotateX(-Math.PI / 2);
  add(d, M.fosco, tampa).position.set(0, mm(y1 + .7), mm(-3 * k));
  const lg = add(new THREE.PlaneGeometry(mm(14 * k), mm(14 * k)), logoTampa, tampa); lg.rotation.x = -Math.PI / 2; lg.position.set(0, mm(y1 + 4.2), mm(-4 * k));
  const bo = add(new THREE.ShapeGeometry(ret(mm(24 * k), mm(7 * k), mm(3.5 * k)), 12), M.breu, tampa); bo.rotation.x = -Math.PI / 2; bo.position.set(0, mm(y1 + .75), mm(26 * k));
  const a = new THREE.ExtrudeGeometry(ret(mm(22 * k), mm(11 * k), mm(4 * k)), { depth: mm(1.6), bevelEnabled: true, bevelThickness: mm(.4), bevelSize: mm(.4), bevelSegments: 3 }); a.rotateX(-Math.PI / 2);
  const ab = add(a, M.fume, tampa); ab.position.set(0, mm(y1 + 2.6), mm(-(rI - 2.7))); ab.rotation.x = -.12;
  // alça: faixa chata de 12 mm que gira no aro e deita sobre o corpo
  if (P.alca) {
    const yA = h + P.aro / 2, al = new THREE.Group(); al.position.y = mm(yA); al.rotation.x = .384; copo.add(al);
    add(new THREE.LatheGeometry([[38, -5], [38.3, -5.8], [39, -6], [40.3, -6], [40.8, -5.8], [41, -5], [41, 5], [40.8, 5.8], [40.3, 6], [39, 6], [38.3, 5.8], [38, 5], [38, -5]].map(([r, y]) => new THREE.Vector2(mm(r), mm(y))), 140, -Math.PI / 2, Math.PI), M.casco, al);
    for (const s of [-1, 1]) {
      const b = add(new THREE.CylinderGeometry(mm(4.5), mm(4.5), mm(2.6), 32), M.casco); b.rotation.z = Math.PI / 2; b.position.set(s * mm(36.8), mm(yA), 0);
      const dz = add(torno([[0, -1.2], [5, -1.2], [5.5, -.6], [5.5, .6], [5, 1.2], [0, 1.2]], 48), M.aco); dz.rotation.z = Math.PI / 2; dz.position.set(s * mm(42.3), mm(yA), 0);
    }
  }
  sombra.scale.setScalar(P.sombra);
  aplicarCor(cor); montarMiniaturas();
}
function aplicarCor(c) {
  cor = c; const C = CORES[c], P = PRODUTOS[prod];
  const circ = 2 * Math.PI * (P.rTopo + P.rBase) / 2, alt = P.corpoAte - 4, W = 2048, H = Math.round(W * alt / circ), px = W / circ;
  const col = tela(W, H), rm = tela(W, H), a = col.getContext('2d'), b = rm.getContext('2d');
  a.fillStyle = C.base; a.fillRect(0, 0, W, H); b.fillStyle = orm(C.rug, C.metal); b.fillRect(0, 0, W, H);
  if (C.escovado) { const r = rnd(5); for (let i = 0; i < 6000; i++) { b.fillStyle = orm(.26 + r() * .08, 1); b.fillRect(0, r() * H, W, 1 + r()); } }
  // largura real do corpo na altura do logo (o copo é cônico): assim o logo não estica
  const cy = H * .46, hc = P.corpoAte - .46 * alt, rL = P.rBase + (P.rTopo - P.rBase) * (hc - 4) / alt;
  const pxH = W / (2 * Math.PI * rL), pxV = H / alt;
  logoCurvo(a, C.logo, P.logo, rL, W / 2, cy, pxH, pxV); logoCurvo(b, orm(C.lr, C.lm), P.logo, rL, W / 2, cy, pxH, pxV);
  // número da Founders Edition, pequeno, logo abaixo do logo
  if (numero) {
    const fs = Math.round(4.6 * pxV), y = cy + P.logo * pxV * .82, txt = 'Nº ' + String(numero).padStart(4, '0');
    for (const [k, c] of [[a, C.logo], [b, orm(C.lr, C.lm)]]) {
      k.save(); k.scale(pxH / pxV, 1); k.fillStyle = c; k.font = `600 ${fs}px "DM Mono", ui-monospace, monospace`; k.textAlign = 'center';
      if ('letterSpacing' in k) k.letterSpacing = Math.round(fs * .14) + 'px';
      k.fillText(txt, (W / 2) * pxV / pxH, y); k.restore();
    }
  }
  // textura nova a cada troca: copo e garrafa têm tamanhos diferentes, e reaproveitar a antiga esticava o logo
  tx.col.dispose(); tx.rm.dispose();
  tx.col = new THREE.CanvasTexture(col); tx.col.colorSpace = THREE.SRGBColorSpace; tx.rm = new THREE.CanvasTexture(rm);
  tx.col.anisotropy = tx.rm.anisotropy = renderer.capabilities.getMaxAnisotropy();
  M.corpo.map = tx.col; M.corpo.roughnessMap = M.corpo.metalnessMap = tx.rm;
  M.corpo.clearcoat = C.coat; M.corpo.needsUpdate = true;
  M.casco.color.set(C.base); M.casco.metalness = C.metal; M.casco.roughness = C.rug; M.casco.clearcoat = C.coat;
}

const cam = new THREE.PerspectiveCamera(18, 1, .01, 10);
const ctl = new OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.enablePan = false; ctl.minDistance = .22; ctl.maxDistance = 1.8;
// Não briga com a rolagem da página: a roda do mouse rola a página (o zoom fica nos botões + e −)
// e, no toque, arrastar para cima ou para baixo rola a página; só o arraste para os lados gira o 3D.
ctl.enableZoom = false;
canvas.style.touchAction = 'pan-y';
// Vitrine: gira devagar sozinho, como produto em exposição; para quando a pessoa pega para girar.
// A câmera fica perto da altura dos olhos (sem olhar de cima ou de baixo demais).
ctl.minPolarAngle = 1.2; ctl.maxPolarAngle = 1.62;
ctl.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; ctl.autoRotateSpeed = .45;
ctl.addEventListener('start', () => { ctl.autoRotate = false; });
let atual = { copo: [0, 0, 0, 0], tampa: [0, 0, 0, 0, 0] }, destino = null;
function pose(p) { copo.rotation.set(p.copo[0], p.copo[1], p.copo[2]); copo.position.y = p.copo[3]; tampa.position.set(p.tampa[0], p.tampa[1], p.tampa[2]); tampa.rotation.set(p.tampa[3], 0, p.tampa[4]); sombra.material.opacity = 1 - Math.min(1, p.copo[3] * 25); }
function irPara(i, ja) {
  const [, c, al, cp, tp] = PRODUTOS[prod].angulos[i];
  opcoes.aoMudarAngulo?.(i);
  if (ja) { cam.position.fromArray(c); ctl.target.fromArray(al); atual = { copo: [...cp], tampa: [...tp] }; pose(atual); destino = null; return; }
  destino = { cam: new THREE.Vector3(...c), alvo: new THREE.Vector3(...al), copo: cp, tampa: tp, t: 0 };
}
// compara com a última medida desta câmera (não com o canvas): se o canvas for reaproveitado, a câmera nova ainda recebe a proporção certa
let medida = '';
const tamanho = () => { const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio(), m = `${w}x${h}x${pr}`; if (w && h && m !== medida) { medida = m; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } };
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
function montarMiniaturas() {
  tamanho(); const lista = [];
  PRODUTOS[prod].angulos.forEach((a, i) => { irPara(i, true); ctl.update(); renderer.render(scene, cam); let img = ''; try { img = canvas.toDataURL('image/png'); } catch (e) {} lista.push({ nome: a[0], img }); });
  irPara(0, true); opcoes.aoMiniaturas?.(lista);
}
let raf = 0;
(function quadro() {
  raf = requestAnimationFrame(quadro); tamanho();
  if (destino) { const k = calmo ? 1 : .12; destino.t += k; cam.position.lerp(destino.cam, k); ctl.target.lerp(destino.alvo, k);
    atual.copo = atual.copo.map((v, i) => v + (destino.copo[i] - v) * k); atual.tampa = atual.tampa.map((v, i) => v + (destino.tampa[i] - v) * k); pose(atual); if (destino.t > 4) destino = null; }
  ctl.update(); renderer.render(scene, cam);
})();
montar();
return {
  produto(p) { prod = p; montar(); },
  cor(c) { aplicarCor(c); },
  numero(n) { numero = n; aplicarCor(cor); },
  irPara(i) { irPara(i); },
  zoom(f) { destino = null; cam.position.sub(ctl.target).multiplyScalar(f).add(ctl.target); },
  destruir() { cancelAnimationFrame(raf); ctl.dispose(); scene.traverse((o) => { o.geometry?.dispose(); }); Object.values(M).forEach((m) => m.dispose()); tx.col.dispose(); tx.rm.dispose(); renderer.dispose(); },
};
}
