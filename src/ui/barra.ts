// Barra de rolagem própria: fina, sobreposta, aparece ao rolar e no hover da borda, arrastável.
// A nativa fica escondida (sem scrollbar-gutter: nada de faixa reservada na lateral). Some em telas de toque (CSS).
import { $, exigir } from '../core/dom.ts';
import { rolarPara } from '../core/rolagem.ts';

export function iniciarBarra(): void {
  const barra = $('.barra');
  if (!barra) return;
  const polegar = exigir('.barra__polegar', barra);
  let altura = 0;
  let curso = 0;
  let timer = 0;
  const percurso = (): number => document.documentElement.scrollHeight - window.innerHeight;

  function posicionar(): void {
    const doc = percurso();
    const t = doc > 0 ? window.scrollY / doc : 0;
    polegar.style.transform = `translate3d(0, ${(t * curso).toFixed(1)}px, 0)`;
  }
  function medir(): void {
    const h = window.innerHeight;
    altura = Math.max(40, (h / document.documentElement.scrollHeight) * h);
    curso = h - altura;
    polegar.style.height = `${altura}px`;
    posicionar();
  }

  window.addEventListener('scroll', () => {
    posicionar();
    barra.classList.add('is-ativa');
    clearTimeout(timer);
    timer = window.setTimeout(() => barra.classList.remove('is-ativa'), 900);
  }, { passive: true });
  window.addEventListener('resize', medir);
  new ResizeObserver(medir).observe(document.body);

  // arrastar o polegar
  let inicioY = 0;
  let inicioScroll = 0;
  polegar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    inicioY = e.clientY;
    inicioScroll = window.scrollY;
    barra.classList.add('is-arrastando');
    polegar.setPointerCapture(e.pointerId);
  });
  polegar.addEventListener('pointermove', (e) => {
    if (!barra.classList.contains('is-arrastando')) return;
    rolarPara(inicioScroll + ((e.clientY - inicioY) / curso) * percurso(), true);
  });
  const soltar = (): void => barra.classList.remove('is-arrastando');
  polegar.addEventListener('pointerup', soltar);
  polegar.addEventListener('pointercancel', soltar);
  // clique no trilho pula para o ponto
  barra.addEventListener('pointerdown', (e) => {
    if (e.target === polegar) return;
    rolarPara(((e.clientY - altura / 2) / curso) * percurso());
  });
  medir();
}
