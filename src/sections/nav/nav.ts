// Nav: some ao descer, volta ao subir (com fundo depois do hero). Menu de tela cheia no celular.
import { $, $$, exigir, trocarRotulo } from '../../core/dom.ts';
import { lenis, tela } from '../../core/rolagem.ts';

export function iniciarNav(): void {
  const nav = $('[data-nav]');
  const menu = $('#menu');
  if (!nav || !menu) return;
  const botao = exigir('.nav__menu', nav);
  let ultimoY = window.scrollY;
  let acumulado = 0;

  function aoRolar(): void {
    const y = window.scrollY;
    const d = y - ultimoY;
    ultimoY = y;
    if (!nav || menu?.classList.contains('is-aberto')) return;
    acumulado = Math.sign(d) === Math.sign(acumulado) ? acumulado + d : d;
    if (y < 40) {
      nav.classList.remove('is-escondida', 'is-solida');
      return;
    }
    if (acumulado > 12) nav.classList.add('is-escondida');
    else if (acumulado < -24) nav.classList.remove('is-escondida');
    nav.classList.toggle('is-solida', y > tela.h * 0.6);
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
  // recarregar no meio da página: a nav já nasce com o fundo certo
  nav.classList.toggle('is-solida', window.scrollY > tela.h * 0.6);

  // menu (celular)
  $$('.menu__link', menu).forEach((l, i) => l.style.setProperty('--i', String(i)));
  const rotulo = (t: string): void => {
    const rola = exigir('.rola', botao);
    rola.dataset.texto = t;
    trocarRotulo(rola, t);
  };
  function abrir(): void {
    if (!menu || !nav) return;
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-aberto')));
    botao.setAttribute('aria-expanded', 'true');
    rotulo('Fechar');
    nav.classList.remove('is-escondida');
    document.documentElement.classList.add('menu-aberto');
    lenis?.stop();
  }
  function fechar(foco = true): void {
    if (!menu) return;
    menu.classList.remove('is-aberto');
    botao.setAttribute('aria-expanded', 'false');
    rotulo('Menu');
    document.documentElement.classList.remove('menu-aberto');
    lenis?.start();
    setTimeout(() => { if (!menu.classList.contains('is-aberto')) menu.hidden = true; }, 460);
    if (foco) botao.focus({ preventScroll: true });
  }
  botao.addEventListener('click', () => (menu.classList.contains('is-aberto') ? fechar() : abrir()));
  menu.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('a')) fechar(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-aberto')) fechar(); });
}
