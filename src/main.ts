// A ordem de inicialização. O CSS não entra por aqui: ele vem por <link> no index.html (src/styles/main.css),
// senão no dev do Vite a página aparece crua por um instante a cada recarregamento.
//   1. monta os rótulos que rolam, as linhas e os formulários; mede a página
//   2. o hero entra quando as fontes chegam; o globo (Three.js, num pedaço próprio) entra quando as texturas chegam
//   3. a cada quadro: o giro da mão, o roteiro do globo, o voo do ponto até a busca
// Cada módulo confere se a seção dele existe: tirar uma seção do index.html não quebra nada.
import type { Coreografia } from './cena/coreografia.ts';
import type { Globo } from './cena/globo.ts';
import { $, $$ } from './core/dom.ts';
import { L, ajustarPalavras, medirTudo } from './core/layout.ts';
import { prepararLinhas, revelar } from './core/revelar.ts';
import { aCadaQuadro, reduzido, tela } from './core/rolagem.ts';
import { iniciarContato } from './sections/contato/contato.ts';
import { iniciarBusca } from './sections/dominio/busca.ts';
import { iniciarNav } from './sections/nav/nav.ts';
import { iniciarServicos } from './sections/servicos/servicos.ts';
import { iniciarBarra } from './ui/barra.ts';
import { iniciarCursor } from './ui/cursor.ts';
import { iniciarToque, montarRola } from './ui/toque.ts';

const html = document.documentElement;
if (reduzido) html.classList.add('reduzido');

montarRola();
prepararLinhas();
const busca = iniciarBusca();
iniciarServicos();
iniciarContato();
medirTudo();
// nada transiciona no primeiro quadro (a trava inline do <head>): libera depois de dois quadros
requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('assentou')));

// o texto do hero entra quando as fontes chegam (ou em 2,5 s, se elas demorarem)
let entrou = false;
function entrar(): void {
  if (entrou) return;
  entrou = true;
  html.classList.add('is-carregado');
  $('.hero')?.classList.add('is-visivel');
}
void document.fonts.ready.then(() => requestAnimationFrame(entrar));
setTimeout(entrar, 2500);

// o globo: camada fixa atrás do conteúdo. O Three.js vem num pedaço próprio, sem atrasar a página.
// Sem o hero, sem o canvas ou sem WebGL, a página segue sem ele.
type Cena = { globo: Globo; coreografia: Coreografia };
let cena: Cena | null = null;

async function montarCena(canvas: HTMLCanvasElement): Promise<void> {
  const [{ criarGlobo }, { criarCoreografia }, { criarVoo }, { criarArrasto }] = await Promise.all([
    import('./cena/globo.ts'),
    import('./cena/coreografia.ts'),
    import('./cena/voo.ts'),
    import('./cena/arrasto.ts'),
  ]);
  const globo = criarGlobo(canvas, { leve: tela.celular || (navigator.hardwareConcurrency || 8) <= 4 });
  globo.medir(tela.w, tela.h);
  const coreografia = criarCoreografia(globo);
  const voo = criarVoo(globo, coreografia, busca);
  const arrasto = criarArrasto(coreografia);
  cena = { globo, coreografia };

  let visivelAntes = true;
  aCadaQuadro((dt, t) => {
    arrasto.quadro(dt);
    coreografia.quadro(dt, t);
    voo.quadro();
    // desenha enquanto o globo está na tela e mais um quadro quando ele sai (limpa o canvas)
    const visivel = coreografia.visivel();
    if (visivel || visivelAntes) globo.desenhar();
    visivelAntes = visivel;
  });
  globo.onPronto = () => {
    canvas.classList.add('is-pronto');
    coreografia.acender(performance.now() / 1000);
  };
  // a falha de região acontece quando a frase "Uma cai, outra segura." entra
  const falha = $('[data-falha]');
  if (falha?.classList.contains('is-visivel')) coreografia.falhar();
  falha?.addEventListener('revelou', () => coreografia.falhar());
}

const canvas = L.hero ? $<HTMLCanvasElement>('.globo') : null;
if (canvas) {
  montarCena(canvas).catch(() => busca?.pousar(true)); // sem WebGL: o ponto do sufixo já nasce aceso
} else {
  busca?.pousar(true);
}

void document.fonts.ready.then(() => {
  medirTudo();
  cena?.coreografia.remedir();
});

let timerResize = 0;
let ultimaLargura = tela.w;
window.addEventListener('resize', () => {
  clearTimeout(timerResize);
  timerResize = window.setTimeout(() => {
    // no celular a barra do navegador muda a altura ao rolar: só remede a página se a largura mudou
    const mudouLargura = window.innerWidth !== ultimaLargura;
    ultimaLargura = window.innerWidth;
    if (mudouLargura || !tela.celular) medirTudo();
    else tela.h = window.innerHeight;
    cena?.globo.medir(window.innerWidth, window.innerHeight);
    cena?.coreografia.remedir();
  }, 120);
});

iniciarNav();
iniciarBarra();
iniciarToque();
iniciarCursor();
revelar();

// o nome digitado muda o tamanho do domínio no fecho
for (const el of $$('[data-ajusta]')) el.addEventListener('mudou', ajustarPalavras);
