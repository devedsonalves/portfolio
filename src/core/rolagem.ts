// Um laço só de requestAnimationFrame para tudo que segue a rolagem.
// O Lenis suaviza a roda do mouse (o toque segue o nativo) e anda no mesmo laço; nada prende a página.
import Lenis from 'lenis';

export const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// com movimento reduzido a rolagem fica a nativa, sem suavização
export const lenis: Lenis | null = reduzido ? null : new Lenis({ autoRaf: false, lerp: 0.1, anchors: true });

/** rola até y (px): pelo Lenis quando ele está ligado */
export function rolarPara(y: number, imediato = false): void {
  if (lenis) lenis.scrollTo(y, { immediate: imediato, force: true });
  else window.scrollTo({ top: y, behavior: imediato ? 'instant' : 'smooth' });
}

const largura = (): number => document.documentElement.clientWidth || window.innerWidth;

/** a rolagem e o tamanho da janela, atualizados a cada quadro (y) e a cada medida (w, h, celular) */
export const tela = {
  y: window.scrollY,
  w: largura(),
  h: window.innerHeight,
  celular: largura() <= 760,
};

/** dt e tempo em segundos */
export type Tarefa = (dt: number, tempo: number) => void;

const tarefas = new Set<Tarefa>();
let ultimo = 0;

function quadro(agora: number): void {
  const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 1 / 60;
  ultimo = agora;
  lenis?.raf(agora);
  tela.y = window.scrollY;
  for (const f of tarefas) f(dt, agora / 1000);
  requestAnimationFrame(quadro);
}
requestAnimationFrame(quadro);

/** registra uma função chamada a cada quadro; devolve a função que a desliga */
export function aCadaQuadro(f: Tarefa): () => void {
  tarefas.add(f);
  return () => tarefas.delete(f);
}

/** persegue o alvo com suavização exponencial (igual a 60 ou 120 Hz) */
export function amortecer(atual: number, alvo: number, lambda: number, dt: number): number {
  return alvo + (atual - alvo) * Math.exp(-lambda * dt);
}

export const limitar = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
export const suave = (t: number): number => t * t * (3 - 2 * t);
export const misturar = (a: number, b: number, t: number): number => a + (b - a) * t;
export const faixa = (v: number, a: number, b: number): number => limitar((v - a) / (b - a));
