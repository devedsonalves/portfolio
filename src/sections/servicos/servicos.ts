// Serviços: escolher uma linha acende o ponto dela (um radiogroup, com as setas do teclado); o resumo e o fecho
// mostram o domínio digitado, o nome do serviço e o preço. Preço que não é número ("sob consulta") vai como está.
import { $, $$ } from '../../core/dom.ts';
import { SERVICOS, definir, dominio, ouvir } from '../../core/estado.ts';

const ehNumero = (preco: string): boolean => /^\d/.test(preco);

export function iniciarServicos(): void {
  const lista = $('[data-servicos]');
  if (!lista) return;
  const linhas = $$<HTMLButtonElement>('.servico', lista);

  linhas.forEach((l, i) => {
    l.style.setProperty('--i', String(i));
    l.classList.toggle('is-texto', !ehNumero(l.dataset.preco ?? ''));
  });

  // a lista entra uma vez, linha por linha
  new IntersectionObserver((es, io) => {
    if (es.some((e) => e.isIntersecting)) { lista.classList.add('is-visivel'); io.disconnect(); }
  }, { rootMargin: '0px 0px -12% 0px' }).observe(lista);

  function escolher(linha: HTMLButtonElement, foco = false): void {
    for (const l of linhas) {
      const sim = l === linha;
      l.setAttribute('aria-checked', String(sim));
      l.tabIndex = sim ? 0 : -1;
    }
    if (foco) linha.focus();
    definir({ servico: linha.dataset.servico ?? '' });
  }

  linhas.forEach((l, i) => {
    l.addEventListener('click', () => escolher(l));
    l.addEventListener('keydown', (e) => {
      const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!passo) return;
      e.preventDefault();
      const prox = linhas[(i + passo + linhas.length) % linhas.length];
      if (prox) escolher(prox, true);
    });
  });
  const inicial = linhas.find((l) => l.getAttribute('aria-checked') === 'true') ?? linhas[0];
  if (inicial) escolher(inicial);

  // o resumo e o fecho escutam o nome e o serviço
  ouvir((e) => {
    const servico = SERVICOS[e.servico];
    const preco = servico?.preco ?? '';
    const numero = ehNumero(preco);
    for (const el of $$('[data-dominio]')) {
      const novo = dominio(e);
      if (el.textContent !== novo) {
        el.textContent = novo;
        el.dispatchEvent(new CustomEvent('mudou'));
      }
    }
    for (const el of $$('[data-servico-nome]')) el.textContent = servico?.nome ?? '';
    for (const el of $$('[data-servico-preco]')) el.textContent = numero ? `R$ ${preco} por mês` : preco;
    for (const el of $$('[data-fecho-preco]')) el.textContent = numero ? `R$ ${preco}` : preco;
  });
}
