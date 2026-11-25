// Para onde o laptop vai em cada ponto da rolagem. Só imagem segue a rolagem: posição, tamanho e giro, e a luz
// das cidades na tela dele. A tampa abre uma vez, por tempo, na entrada. A página nunca para: o laptop é uma camada
// fixa que sobe mais devagar que o conteúdo.
import { L } from '../core/layout.ts';
import { amortecer, limitar, misturar, reduzido, suave, tela } from '../core/rolagem.ts';
import { type Globo, PAPEIS, type Pose, type Projecao, REGIOES } from './globo.ts';

/** um quadro-chave: s é a posição da rolagem (px); o resto, a pose do globo */
type Quadro = Pose & { s: number };
const CHAVES = ['cx', 'cy', 'r', 'lat', 'lon'] as const;

// os quadros-chave. lat inclina (positivo mostra o teclado de cima) e lon vira (0 é de frente; positivo vira a tela
// para a esquerda): o laptop entra de três quartos, encara as frases e sai virando
function quadros(): Quadro[] {
  const { w: W, h: H, celular } = tela;
  const hero = L.hero;
  if (!hero) return [{ s: 0, cx: W / 2, cy: -H, r: 100, lat: 0, lon: 0 }];
  const reg = L.regioes;
  // no celular o hero mede o globo maior que a tela; o laptop precisa caber de lado a lado
  const r0 = celular ? W * 0.4 : hero.d * 0.42;
  // o laptop sobe por cima da palavra gigante só até o pé das letras (hero.globoTopo): o nome continua legível.
  // De três quartos e inclinado, o alto da tampa fica a uns 0,86 r acima do centro
  const cy0 = hero.globoTopo + r0 * 0.86;
  // sem a seção de regiões, ele só sobe e sai pelo alto quando o hero acaba
  if (!reg) {
    return [
      { s: 0, cx: W / 2, cy: cy0, r: r0, lat: 18, lon: -16 },
      { s: hero.altura * 0.9, cx: W / 2, cy: -r0 - 80, r: r0, lat: 8, lon: 24 },
    ];
  }
  const fimReg = reg.topo + reg.altura;
  // virado, o laptop fica mais largo que a meia largura de frente: a sobra não pode chegar nas frases
  const r1 = L.r1 * (celular ? 0.9 : 0.84);
  if (celular) {
    return [
      { s: 0, cx: W / 2, cy: cy0, r: r0, lat: 18, lon: -16 },
      { s: reg.topo - H * 0.15, cx: W / 2, cy: H * 0.33, r: r1, lat: 14, lon: -6 },
      { s: reg.a.topo - H * 0.2, cx: W / 2, cy: H * 0.33, r: r1, lat: 10, lon: 4 },
      { s: reg.b.topo - H * 0.55, cx: W / 2, cy: H * 0.33, r: r1, lat: 12, lon: 18 },
      { s: fimReg - H * 0.25, cx: W / 2, cy: -r1 - 80, r: r1, lat: 6, lon: 34 },
    ];
  }
  return [
    { s: 0, cx: W / 2, cy: cy0, r: r0, lat: 18, lon: -16 },
    { s: reg.topo - H * 0.04, cx: W / 2, cy: H * 0.5, r: r1, lat: 14, lon: -8 },
    { s: reg.a.topo - H * 0.1, cx: W / 2, cy: H * 0.5, r: r1, lat: 10, lon: 2 },
    { s: reg.b.topo - H * 0.25, cx: W / 2, cy: H * 0.5, r: r1, lat: 12, lon: 11 },
    { s: fimReg - H * 0.95, cx: W / 2, cy: H * 0.5, r: r1, lat: 8, lon: 18 },
    { s: fimReg - H * 0.05, cx: W / 2, cy: -r1 - 100, r: r1 * 0.94, lat: 4, lon: 40 },
  ];
}

function interpolar(qs: Quadro[], s: number): Pose {
  const primeiro = qs[0];
  const ultimo = qs[qs.length - 1];
  if (!primeiro || !ultimo) return { cx: 0, cy: 0, r: 0, lat: 0, lon: 0 };
  if (s <= primeiro.s) return { ...primeiro };
  for (let i = 1; i < qs.length; i++) {
    const a = qs[i - 1];
    const b = qs[i];
    if (!a || !b || s > b.s) continue;
    const t = suave(limitar((s - a.s) / (b.s - a.s)));
    const o = { cx: 0, cy: 0, r: 0, lat: 0, lon: 0 };
    for (const k of CHAVES) o[k] = misturar(a[k], b[k], t);
    return o;
  }
  return { ...ultimo };
}

export interface Coreografia {
  quadro(dt: number, agora: number): void;
  remedir(): void;
  /** liga a entrada: a tampa abre e as cidades acendem uma a uma, de oeste para leste */
  acender(agora: number): void;
  /** uma cidade cai e a vizinha assume (uma vez por entrada da frase) */
  falhar(): void;
  visivel(): boolean;
  /** tira (ou devolve) a cidade i do globo: o voo até a busca */
  segurar(i: number, sim: boolean): void;
  /** a pose suavizada do roteiro */
  atual: Pose;
  /** o giro da mão (arrasto.ts), somado por cima do roteiro */
  giro: { lat: number; lon: number };
}

export function criarCoreografia(globo: Globo): Coreografia {
  let qs = quadros();
  const atual = interpolar(qs, tela.y);
  const ponto: Projecao = { x: 0, y: 0, face: 0 };
  const aplicado: Pose = { ...atual };
  const giro = { lat: 0, lon: 0 };
  const N = REGIOES.length;
  const aceso = new Array<boolean>(N).fill(false);
  // a posição de cada cidade na ordem de oeste para leste
  const ordemOeste = new Array<number>(N).fill(0);
  REGIOES.map((r, i) => ({ i, lon: r.lon })).sort((a, b) => a.lon - b.lon).forEach((r, k) => { ordemOeste[r.i] = k; });
  const alvoBrilho = new Float32Array(N);
  let falha = -1;
  let inicio = -1;
  const presos = new Set<number>(); // cidades que saíram do globo (o voo até a busca)
  let ultimoY = tela.y;

  function quadro(dt: number, agora: number): void {
    const alvo = interpolar(qs, tela.y);
    // salto grande (âncora, recarregar no meio): vai direto, sem atravessar a tela
    const salto = Math.abs(tela.y - ultimoY) > tela.h * 1.5;
    ultimoY = tela.y;
    if (tela.celular && L.regioes) {
      // no celular a primeira frase empurra o globo para cima e ele sai com ela:
      // nunca fica atrás de texto nem volta por cima dele
      const topoNaTela = L.regioes.a.topo - tela.y;
      alvo.cy = Math.min(alvo.cy, topoNaTela - 28 - alvo.r);
    }
    // balanço lento e limitado (nunca acumula): está vivo mesmo parado
    alvo.lon += reduzido ? 0 : Math.sin(agora * 0.16) * 3;
    const k = reduzido || salto ? 1e3 : 7.5;
    for (const c of CHAVES) atual[c] = amortecer(atual[c], alvo[c], k, dt);
    // o giro da mão entra por cima do roteiro, sem suavização: segue o dedo
    aplicado.cx = atual.cx;
    aplicado.cy = atual.cy;
    aplicado.r = atual.r;
    aplicado.lat = atual.lat + giro.lat;
    aplicado.lon = atual.lon + giro.lon;
    // a tampa abre em 1,4 s depois que tudo chegou (aberta de vez se a página já carregou rolada ou sem movimento)
    if (inicio >= 0) globo.abertura = reduzido || tela.y > 40 ? 1 : limitar((agora - inicio) / 1.4);
    globo.aplicar(aplicado);

    // a luz das cidades
    for (let i = 0; i < N; i++) {
      globo.projetar(i, ponto);
      const naTela = ponto.y > -40 && ponto.y < tela.h + 40;
      if (!aceso[i] && inicio >= 0 && ponto.face > 0.18 && naTela) {
        // entrada: uma cidade a cada 110 ms, de oeste para leste
        if (agora - inicio > 1.05 + (ordemOeste[i] ?? 0) * 0.11 || tela.y > 40) aceso[i] = true;
      }
      alvoBrilho[i] = aceso[i] ? 1 : 0;
    }
    if (falha >= 0) {
      const t = performance.now() / 1000 - falha;
      // a cidade data-cai apaga e a data-assume brilha mais forte; voltam depois de 3,2 s
      if (t < 3.2) { alvoBrilho[PAPEIS.cai] = 0.12; alvoBrilho[PAPEIS.assume] = 1.55; }
      else if (t > 6) falha = -1;
    }
    for (let i = 0; i < N; i++) {
      if (presos.has(i)) { globo.brilho[i] = 0; continue; }
      const de = globo.brilho[i] ?? 0;
      const para = alvoBrilho[i] ?? 0;
      globo.brilho[i] = reduzido ? para : amortecer(de, para, para > de ? 5 : 3.5, dt);
    }
  }

  return {
    quadro,
    remedir: () => { qs = quadros(); },
    acender: (agora) => { inicio = agora; globo.ligar(agora); },
    falhar: () => { if (falha < 0) falha = performance.now() / 1000; },
    visivel: () => atual.cy + atual.r > -80 && atual.cy - atual.r < tela.h + 80,
    segurar: (i, sim) => { if (sim) presos.add(i); else presos.delete(i); },
    atual,
    giro,
  };
}
