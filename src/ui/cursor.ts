// Cursor próprio, só com mouse: um ponto de tinta que segue a mão na hora e um anel fino que vem atrás, amortecido
// no mesmo requestAnimationFrame da página (core/rolagem.ts). Sobre um clicável o anel cresce e o ponto vira luz (o
// acento); sobre o globo do hero aparece "Girar"; segurando, o anel encolhe. Em campo de texto o cursor próprio
// some e volta o do sistema. Rolando, não muda de estado (a mesma regra do hover). Movimento reduzido: sem atraso.
import { $, exigir } from '../core/dom.ts';
import { aCadaQuadro, amortecer, reduzido } from '../core/rolagem.ts';

const CLICAVEL = 'a, button, [role="radio"], label, summary, .tld__escolher';
const TEXTO = 'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';

export function iniciarCursor(): void {
  const el = $('.cursor');
  // só onde há mouse de verdade
  if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const html = document.documentElement;
  const ponto = exigir('.cursor__ponto', el);
  const anel = exigir('.cursor__anel', el);
  const hero = $('.hero');
  html.classList.add('tem-cursor');

  const mao = { x: -100, y: -100 };
  const atras = { x: -100, y: -100 };
  let visto = false;
  let alvo: Element | null = null;

  function estado(): void {
    if (!el || html.classList.contains('is-scrolling')) return;
    const sobreTexto = !!alvo?.closest(TEXTO);
    const sobreClicavel = !sobreTexto && !!alvo?.closest(CLICAVEL);
    const girando = !!hero?.classList.contains('is-girando');
    const giravel = !sobreClicavel && (girando || !!hero?.classList.contains('is-giravel'));
    el.classList.toggle('is-texto', sobreTexto);
    el.classList.toggle('is-clicavel', sobreClicavel);
    el.classList.toggle('is-giravel', giravel);
    el.classList.toggle('is-girando', girando);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mao.x = e.clientX;
    mao.y = e.clientY;
    alvo = e.target instanceof Element ? e.target : null;
    if (!visto) {
      // primeira vez: o anel nasce no lugar, sem atravessar a tela
      visto = true;
      atras.x = mao.x;
      atras.y = mao.y;
      el.classList.add('is-visivel');
    }
    estado();
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { el.classList.add('is-apertado'); estado(); } });
  window.addEventListener('pointerup', () => { el.classList.remove('is-apertado'); estado(); });
  // a rolagem acaba (ui/toque.ts tira o .is-scrolling): o estado volta a seguir o que está embaixo
  window.addEventListener('scrollend', estado);
  document.addEventListener('mouseleave', () => el.classList.remove('is-visivel'));
  document.addEventListener('mouseenter', () => { if (visto) el.classList.add('is-visivel'); });

  aCadaQuadro((dt) => {
    if (!visto) return;
    if (reduzido) {
      atras.x = mao.x;
      atras.y = mao.y;
    } else {
      atras.x = amortecer(atras.x, mao.x, 18, dt);
      atras.y = amortecer(atras.y, mao.y, 18, dt);
    }
    ponto.style.transform = `translate3d(${mao.x}px, ${mao.y}px, 0)`;
    anel.style.transform = `translate3d(${atras.x.toFixed(1)}px, ${atras.y.toFixed(1)}px, 0)`;
  });
}
