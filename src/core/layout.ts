// Medidas da página: ajusta as palavras gigantes à largura da tela (data-palavra), o domínio do fecho (data-ajusta),
// posiciona o hero (palavra, texto e globo) e anota onde cada seção começa (L). Roda no load, nas fontes e no resize.
import { $, $$ } from './dom.ts';
import { tela } from './rolagem.ts';

const docTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;
const margem = (): number => Math.min(72, Math.max(20, tela.w * 0.039));

interface MedidaPalavra {
  /** tamanho da fonte (px) */
  f: number;
  /** distância do topo da caixa até a linha de base (px) */
  base: number;
  /** altura das letras altas (px) */
  alto: number;
  /** largura do texto (px) */
  w: number;
}
const medidas = new WeakMap<Element, MedidaPalavra>();

function larguraDoTexto(el: Element): number {
  const faixa = document.createRange();
  faixa.selectNodeContents(el);
  return faixa.getBoundingClientRect().width;
}

// mede a palavra a 100 px: largura, linha de base e topo das letras altas
function medir(el: HTMLElement): Omit<MedidaPalavra, 'f'> {
  const antes = el.style.fontSize;
  el.style.fontSize = '100px';
  const caixa = el.getBoundingClientRect();
  // a largura é a do texto (o elemento pode ser um bloco na largura toda)
  const w = larguraDoTexto(el);
  const sonda = document.createElement('span');
  sonda.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  el.appendChild(sonda);
  const base = sonda.getBoundingClientRect().top - caixa.top;
  sonda.remove();
  const cs = getComputedStyle(el);
  const ctx = document.createElement('canvas').getContext('2d');
  let alto = 74;
  if (ctx) {
    ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    alto = ctx.measureText((el.textContent ?? '').trim()).actualBoundingBoxAscent || alto;
  }
  el.style.fontSize = antes;
  return { w, base, alto };
}

interface Faixa { topo: number; altura: number }

/** as medidas da página; cada uma fica null quando a seção dela não está no index.html */
export const L: {
  hero: { altura: number; topoLetras: number; base: number; globoTopo: number; d: number } | null;
  /** o raio do globo enquanto as frases das regiões passam */
  r1: number;
  regioes: (Faixa & { a: Faixa; b: Faixa }) | null;
  busca: (Faixa & { esquerda: number }) | null;
  dominio: { topo: number } | null;
  rodape: Faixa | null;
  doc: number;
} = { hero: null, r1: 0, regioes: null, busca: null, dominio: null, rodape: null, doc: 0 };

export function ajustarPalavras(): void {
  // palavras gigantes de ponta a ponta
  for (const el of $$('[data-palavra]')) {
    const m = medir(el);
    const borda = Math.max(6, tela.w * 0.007);
    let f = ((tela.w - borda * 2) / m.w) * 100;
    if (el.classList.contains('hero__palavra') && !tela.celular) {
      // em tela muito larga a palavra não passa de 36% da altura
      f = Math.min(f, (tela.h * 0.36) / (m.alto / 100));
    }
    el.style.fontSize = `${f.toFixed(2)}px`;
    medidas.set(el, { f, base: (m.base * f) / 100, alto: (m.alto * f) / 100, w: (m.w * f) / 100 });
  }
  // o domínio do fecho: ocupa a largura útil, com teto
  for (const el of $$('[data-ajusta]')) {
    el.style.fontSize = '100px';
    const w = larguraDoTexto(el);
    const util = tela.w - 2 * margem();
    const teto = tela.celular ? 64 : Math.min(tela.h * 0.2, 180);
    el.style.fontSize = `${Math.min(teto, (util / w) * 100).toFixed(2)}px`;
  }
}

function medirHero(): void {
  const hero = $('.hero');
  const palavra = hero && $('.hero__palavra', hero);
  const m = palavra && medidas.get(palavra);
  if (!hero || !m) { L.hero = null; return; }
  const W = tela.w;
  const H = hero.getBoundingClientRect().height;
  const navH = tela.celular ? 64 : 96;
  let topoLetras: number;
  let d: number;
  let globoTopo: number;
  const sub = $('.hero__sub', hero);
  const lead = $('.hero__lead', hero);
  if (tela.celular && sub && lead) {
    const leadFim = lead.offsetTop + lead.offsetHeight;
    hero.style.setProperty('--sub-topo', `${Math.round(leadFim + 18)}px`);
    const subFim = leadFim + 18 + sub.offsetHeight;
    topoLetras = Math.max(subFim + 40, H * 0.355);
    d = W * 1.5;
    globoTopo = topoLetras + m.alto * 0.7;
  } else {
    topoLetras = Math.max(navH + 16, H * 0.137);
    d = Math.min(W * 0.515, H * 0.88);
    globoTopo = topoLetras + m.alto * 0.71;
  }
  const palavraTopo = topoLetras - (m.base - m.alto);
  const base = topoLetras + m.alto;
  hero.style.setProperty('--palavra-tam', `${m.f.toFixed(2)}px`);
  hero.style.setProperty('--palavra-topo', `${palavraTopo.toFixed(1)}px`);
  hero.style.setProperty('--base', `${base.toFixed(1)}px`);
  hero.style.setProperty('--globo-topo', `${globoTopo.toFixed(1)}px`);
  hero.style.setProperty('--globo-d', `${d.toFixed(1)}px`);
  L.hero = { altura: H, topoLetras, base, globoTopo, d };
}

function medirSecoes(): void {
  // o globo das regiões: cabe entre as duas colunas de texto
  L.r1 = tela.celular ? tela.w * 0.5 : Math.min(tela.h * 0.37, (tela.w - 2 * margem()) * 0.225);
  document.documentElement.style.setProperty('--globo-regioes', `${(L.r1 * 2).toFixed(1)}px`);
  const reg = $('.regioes');
  const a = reg && $('.regioes__bloco--a', reg);
  const b = reg && $('.regioes__bloco--b', reg);
  L.regioes = reg && a && b ? {
    topo: docTop(reg),
    altura: reg.offsetHeight,
    a: { topo: docTop(a), altura: a.offsetHeight },
    b: { topo: docTop(b), altura: b.offsetHeight },
  } : null;
  const campo = $('.busca__campo');
  L.busca = campo ? { topo: docTop(campo), altura: campo.offsetHeight, esquerda: campo.getBoundingClientRect().left } : null;
  const dominio = $('.dominio');
  L.dominio = dominio ? { topo: docTop(dominio) } : null;
  const rodape = $('.rodape');
  L.rodape = rodape ? { topo: docTop(rodape), altura: rodape.offsetHeight } : null;
  L.doc = document.documentElement.scrollHeight;
}

export function medirTudo(): void {
  tela.w = document.documentElement.clientWidth || window.innerWidth;
  tela.h = window.innerHeight;
  tela.celular = tela.w <= 760;
  ajustarPalavras();
  medirHero();
  medirSecoes();
}
