// Hover desligado enquanto a página rola (o cursor parado não acende nada no caminho) e toque no celular com a mesma
// resposta do hover (.is-toque). Também monta o texto que rola dos botões (.rola).
import { $$ } from '../core/dom.ts';

const TOCAVEL = '.link, .botao, .botao-seta, .nav__marca, .nav__menu, .menu__link, .servico, .projeto, .tld__escolher, .tld__acao, .sugestao, .rodape__status, .contato__email';

export function iniciarToque(): void {
  const html = document.documentElement;
  let ultimoX = -1;
  let ultimoY = -1;
  window.addEventListener('scroll', () => html.classList.add('is-scrolling'), { passive: true });
  window.addEventListener('mousemove', (e) => {
    // o Safari zera movementX fora do pointer lock: compara a posição
    if (e.clientX !== ultimoX || e.clientY !== ultimoY) {
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      html.classList.remove('is-scrolling');
    }
  }, { passive: true });

  // toque: o mesmo estado do hover por um instante, só se o dedo não arrastar
  let alvo: Element | null = null;
  let timer = 0;
  let x0 = 0;
  let y0 = 0;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !(e.target instanceof Element)) return;
    alvo = e.target.closest(TOCAVEL);
    if (!alvo) return;
    x0 = e.clientX;
    y0 = e.clientY;
    clearTimeout(timer);
    const el = alvo;
    timer = window.setTimeout(() => el.classList.add('is-toque'), 70);
  }, { passive: true });
  const soltar = (): void => {
    clearTimeout(timer);
    const el = alvo;
    if (el) setTimeout(() => el.classList.remove('is-toque'), 260);
    alvo = null;
  };
  document.addEventListener('pointermove', (e) => {
    if (!alvo || Math.hypot(e.clientX - x0, e.clientY - y0) <= 8) return;
    clearTimeout(timer);
    alvo.classList.remove('is-toque');
    alvo = null;
  }, { passive: true });
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);
}

/** o rótulo do botão sobe e a cópia entra por baixo */
export function montarRola(raiz: ParentNode = document): void {
  for (const el of $$('.rola', raiz)) {
    if (el.querySelector('.rola__a')) continue;
    const t = el.dataset.texto || (el.textContent ?? '').trim();
    el.textContent = '';
    const a = document.createElement('span');
    a.className = 'rola__a';
    a.textContent = t;
    const b = document.createElement('span');
    b.className = 'rola__b';
    b.setAttribute('aria-hidden', 'true');
    b.textContent = t;
    el.append(a, b);
  }
}
