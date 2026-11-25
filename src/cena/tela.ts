// A tela do laptop: um editor com uma função curta digitada uma vez, por tempo, depois que a tampa abre. Cada letra
// que entra acende a tecla dela no teclado do modelo (globo.ts lê as teclas daqui). Desenhado num <canvas> 2D que
// vira textura; só redesenha quando algo muda. Tipo: a Archivo do site, estreita (uma família só).

/** o código da tela: sem "/" nem caractere que o teclado do modelo não tem */
const CODIGO = [
  'async function publicar(ideia: Ideia) {',
  '  const sistema = await construir(ideia);',
  '  await testar(sistema);',
  '  return colocarNoAr(sistema);',
  '}',
];
const TEXTO = CODIGO.join('\n');
const PALAVRAS_CHAVE = new Set(['async', 'function', 'const', 'await', 'return']);
const FUNCOES = new Set(['publicar', 'construir', 'testar', 'colocarNoAr']);
const TIPOS = new Set(['Ideia']);

// ---------- o teclado ----------
// a posição de cada tecla, medida na textura laptop.keyboard (o desenho das letras, em px de uma cópia de 1932 px).
// No topo das teclas a textura é linear com a posição: x = 4,1443 u - 2,1067 e z = 4,1443 v - 2,0069 (espaço do nó
// "keyboard" do modelo), com u e v = px / 1932.
const LINHAS: [number, string, number[]][] = [
  [800, '1234567890-=', [267, 386, 505, 627, 747, 871, 991, 1111, 1232, 1355, 1478, 1600]],
  [900, 'qwertyuiop[]', [325, 445, 566, 687, 808, 932, 1054, 1174, 1296, 1417, 1540, 1660]],
  [1018, "asdfghjkl;'", [354, 476, 598, 719, 841, 963, 1085, 1207, 1329, 1450, 1572]],
  [1137, 'zxcvbnm,.', [415, 536, 779, 900, 1021, 1144, 1266, 1389, 1511]],
];
/** uma tecla: centro no espaço do teclado e a meia largura (as largas, como o espaço, passam de uma tecla) */
export interface Tecla { x: number; z: number; larg: number }
const tecla = (px: number, py: number, larg = 0.1): Tecla =>
  ({ x: 4.1443 * (px / 1932) - 2.1067, z: 4.1443 * (py / 1932) - 2.0069, larg });
const TECLAS = new Map<string, Tecla>();
for (const [y, letras, xs] of LINHAS) [...letras].forEach((c, i) => TECLAS.set(c, tecla(xs[i] ?? 0, y)));
TECLAS.set(' ', tecla(902, 1245, 0.62));
TECLAS.set('\n', tecla(1760, 1018, 0.2));
const SHIFT = tecla(200, 1137, 0.2);
// o que precisa de shift, e a tecla de baixo
const COM_SHIFT: Record<string, string> = { '(': '9', ')': '0', '{': '[', '}': ']', ':': ';', '"': "'", '_': '-', '+': '=' };

/** as teclas de um caractere (com o shift, se precisar) */
export function teclasDe(c: string): Tecla[] {
  const base = COM_SHIFT[c] ?? c.toLowerCase();
  const t = TECLAS.get(base);
  if (!t) return [];
  // maiúscula ou símbolo de cima: a base é outra tecla, e o shift acende junto
  return c !== base ? [t, SHIFT] : [t];
}

// ---------- o tempo da digitação ----------
/** um número de 0 a 1 que é sempre o mesmo para o mesmo i (a cadência não muda a cada visita) */
const ruido = (i: number): number => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** quando cada caractere entra (s, contando do começo da digitação) */
const QUANDO: number[] = [];
{
  let t = 0;
  [...TEXTO].forEach((c, i) => {
    t += 0.045 + ruido(i) * 0.05;
    if (c === '\n') t += 0.26; // fim da linha: respira
    if (c === ' ' && TEXTO[i - 1] === ' ') t -= 0.03; // a indentação sai rápido
    QUANDO.push(t);
  });
}
const DURACAO = QUANDO[QUANDO.length - 1] ?? 0;

// ---------- o desenho ----------
type Papel = 'chave' | 'funcao' | 'tipo' | 'pontuacao' | 'nome';
function papel(palavra: string): Papel {
  if (PALAVRAS_CHAVE.has(palavra)) return 'chave';
  if (FUNCOES.has(palavra)) return 'funcao';
  if (TIPOS.has(palavra)) return 'tipo';
  return /^\w+$/.test(palavra) ? 'nome' : 'pontuacao';
}
/** cada linha em pedaços (palavra ou pontuação), já com o papel */
const PEDACOS = CODIGO.map((l) => (l.match(/\w+|\s+|[^\w\s]/g) ?? []).map((p) => ({ p, papel: papel(p) })));

export interface TelaEditor {
  canvas: HTMLCanvasElement;
  /** desenha o estado do instante t (s desde que a digitação começou; negativo antes). Diz se mudou */
  quadro(t: number): boolean;
  /** quantos caracteres já entraram no instante t */
  digitados(t: number): number;
  texto: string;
  duracao: number;
}

export function criarEditor(aspecto: number, { reduzido = false } = {}): TelaEditor {
  const W = 1280;
  const H = Math.round(W / aspecto);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const cor = (v: string, padrao: string): string => css.getPropertyValue(v).trim() || padrao;
  const C = {
    fundo: cor('--color-preto-topo', '#161617'),
    tinta: cor('--color-tinta', '#ecece9'),
    tinta2: cor('--color-tinta-2', '#9b9c98'),
    tinta3: cor('--color-tinta-3', '#6b6c69'),
    acento: cor('--color-acento', '#e8294c'),
    acentoClaro: cor('--color-acento-claro', '#ffd9df'),
  };
  const corDe: Record<Papel, string> = {
    chave: C.tinta3, funcao: C.tinta, tipo: C.acentoClaro, pontuacao: C.tinta3, nome: C.tinta2,
  };
  const familia = cor('--font-sans', "'Archivo Variable', sans-serif");
  const tam = Math.round(H * 0.066);
  const entre = Math.round(tam * 1.62);
  const margem = Math.round(W * 0.06);
  const topoCodigo = Math.round(H * 0.24);
  let ultimo = '';

  const fonte = (peso: number, px: number): void => {
    if (!ctx) return;
    ctx.font = `${peso} ${px}px ${familia}`;
    if ('fontStretch' in ctx) ctx.fontStretch = 'semi-condensed';
  };

  function digitados(t: number): number {
    if (reduzido) return TEXTO.length;
    if (t < 0) return 0;
    let n = 0;
    while (n < QUANDO.length && (QUANDO[n] ?? Infinity) <= t) n++;
    return n;
  }

  function quadro(t: number): boolean {
    if (!ctx) return false;
    const n = digitados(t);
    const fim = n >= TEXTO.length;
    // o cursor fica aceso enquanto digita e pisca depois (sem piscar com movimento reduzido)
    const cursor = reduzido || !fim || Math.floor((t - DURACAO) * 1.7) % 2 === 0;
    // o "no ar" entra em 0,6 s depois da última tecla
    const noAr = reduzido ? 1 : Math.min(1, Math.max(0, (t - DURACAO - 0.35) / 0.6));
    const chave = `${n}|${cursor ? 1 : 0}|${noAr.toFixed(2)}|${document.fonts.status}`;
    if (chave === ultimo) return false;
    ultimo = chave;

    ctx.fillStyle = C.fundo;
    ctx.fillRect(0, 0, W, H);

    // a aba do arquivo, com o fio aceso embaixo
    fonte(450, Math.round(tam * 0.78));
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.tinta2;
    const nomeArq = 'publicar.ts';
    const yAba = Math.round(H * 0.105);
    ctx.fillText(nomeArq, margem, yAba);
    const larguraAba = ctx.measureText(nomeArq).width;
    ctx.fillStyle = C.tinta3;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, yAba + tam * 0.62, W, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.acento;
    ctx.fillRect(margem, yAba + tam * 0.62 - 1, larguraAba, 3);

    // o código, até o caractere n
    fonte(450, tam);
    let resto = n;
    PEDACOS.forEach((linha, i) => {
      const y = topoCodigo + i * entre;
      // número da linha
      ctx.fillStyle = C.tinta3;
      ctx.globalAlpha = 0.55;
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), margem + tam * 1.1, y);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      let x = margem + tam * 2.1;
      for (const { p, papel: pp } of linha) {
        if (resto <= 0) break;
        const parte = p.slice(0, resto);
        resto -= parte.length;
        ctx.fillStyle = corDe[pp];
        ctx.fillText(parte, x, y);
        x += ctx.measureText(parte).width;
      }
      resto -= 1; // o "\n"
    });
    // o cursor: depois do último caractere digitado
    const linhas = TEXTO.slice(0, n).split('\n');
    const li = linhas.length - 1;
    const cx = margem + tam * 2.1 + ctx.measureText(linhas[li] ?? '').width;
    const cy = topoCodigo + li * entre;
    if (cursor) {
      ctx.fillStyle = C.acento;
      ctx.shadowColor = C.acento;
      ctx.shadowBlur = tam * 0.6;
      ctx.fillRect(cx + 3, cy - tam * 0.78, Math.max(3, tam * 0.09), tam * 0.98);
      ctx.shadowBlur = 0;
    }

    // a barra de baixo: o "no ar" acende quando a função termina
    if (noAr > 0) {
      const yBarra = Math.round(H * 0.9);
      fonte(450, Math.round(tam * 0.78));
      ctx.globalAlpha = noAr;
      ctx.textAlign = 'right';
      ctx.fillStyle = C.tinta;
      const rotulo = 'no ar';
      const xTexto = W - margem;
      ctx.fillText(rotulo, xTexto, yBarra);
      const r = tam * 0.2;
      const xPonto = xTexto - ctx.measureText(rotulo).width - r * 3.2;
      ctx.fillStyle = C.acento;
      ctx.shadowColor = C.acento;
      ctx.shadowBlur = tam * 0.8;
      ctx.beginPath();
      ctx.arc(xPonto, yBarra - tam * 0.26, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    return true;
  }

  return { canvas, quadro, digitados, texto: TEXTO, duracao: DURACAO };
}
