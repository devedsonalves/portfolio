// Texto entra por marco, por tempo: o IntersectionObserver dispara uma vez e a transição de CSS termina sozinha no
// estado final, mesmo com a rolagem rápida. Nada é scrubado. Quem precisa saber escuta o evento "revelou".
import { $$ } from './dom.ts';

/** numera as linhas de cada título (o atraso de 70 ms entre elas vem do --i) */
export function prepararLinhas(raiz: ParentNode = document): void {
  for (const el of $$('.titulo, .hero__lead, .hero__sub', raiz)) {
    $$('.linha', el).forEach((linha, i) => linha.style.setProperty('--i', String(i)));
  }
}

export function revelar(): void {
  const alvos = $$('[data-revela]');
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-visivel');
      e.target.dispatchEvent(new CustomEvent('revelou'));
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -14% 0px', threshold: 0.01 });
  for (const el of alvos) io.observe(el);
}
