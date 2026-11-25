// Busca de domínio fictícia e determinística: o mesmo nome dá sempre o mesmo resultado.
// Estados: vazio, digitando, procurando, disponível, indisponível (com sugestões), erro.
// Num site real, ligue disponivel() à API do registrador.
import { $$, exigir, trocarRotulo } from '../../core/dom.ts';
import { definir, ler } from '../../core/estado.ts';

const COMUNS = ['loja', 'casa', 'site', 'google', 'brasil', 'web', 'app', 'blog', 'shop', 'store',
  'teste', 'meusite', 'empresa', 'online', 'digital', 'studio', 'estudio', 'agencia', 'cafe', 'padaria'];
// quanto cada terminação costuma estar ocupada (0 a 1): data-ocupacao em cada <li class="tld"> do HTML; sem ele, 0,3
const OCUPACAO: Record<string, number> = {};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function disponivel(nome: string, tld: string): boolean {
  if (nome.length <= 3 || COMUNS.includes(nome)) return false;
  return hash(nome + tld) >= (OCUPACAO[tld] ?? 0.3);
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function validar(bruto: string): { nome: string; erro: string } {
  const v = semAcento(bruto.trim().toLowerCase());
  if (!v) return { nome: '', erro: '' };
  if (/\s/.test(v)) return { nome: '', erro: 'Sem espaço: junte as palavras ou use hífen.' };
  if (/[^a-z0-9-]/.test(v)) return { nome: '', erro: 'Use só letras, números e hífen.' };
  if (/^-|-$/.test(v)) return { nome: '', erro: 'O nome não pode começar nem terminar com hífen.' };
  if (v.length < 2) return { nome: '', erro: '' };
  return { nome: v, erro: '' };
}

export interface Busca {
  /** o ponto do sufixo, onde o ponto que voa pousa */
  luz: HTMLElement;
  /** o ponto do globo pousado (aceso) no ponto do sufixo */
  pousar(sim: boolean): void;
}

export function iniciarBusca(): Busca | null {
  const form = document.querySelector<HTMLFormElement>('[data-busca]');
  // sem a seção: nada a buscar, e o voo do ponto não acontece
  if (!form) return null;
  const itens = $$('[data-tlds] .tld');
  for (const li of itens) {
    const v = Number(li.dataset.ocupacao);
    if (li.dataset.tld && li.dataset.ocupacao && Number.isFinite(v)) OCUPACAO[li.dataset.tld] = v;
  }
  const input = exigir<HTMLInputElement>('.busca__input', form);
  const espelho = exigir('.busca__espelho', form);
  const sufixo = exigir('.busca__sufixo', form);
  const sufixoResto = exigir('[data-sufixo-resto]', sufixo);
  const erro = exigir('.busca__erro', form);
  const campo = exigir('.busca__campo', form);
  let timerBusca = 0;
  let timerDigita = 0;
  let timers: number[] = [];
  let ultimoNome: string | null = null;

  // ---- o cursor (o ponto) e o sufixo seguem o texto ----
  function medirTexto(t: string): number {
    espelho.textContent = t;
    return espelho.getBoundingClientRect().width;
  }
  function posicionar(): void {
    const valor = input.value;
    const ini = input.selectionStart ?? valor.length;
    const fim = input.selectionEnd ?? ini;
    const rolado = input.scrollLeft;
    const xCursor = medirTexto(valor.slice(0, ini)) - rolado;
    const larguraTexto = medirTexto(valor || input.placeholder);
    const larguraSufixo = sufixo.getBoundingClientRect().width;
    const util = campo.clientWidth;
    let xSufixo = larguraTexto - rolado + 2;
    if (xSufixo + larguraSufixo > util) xSufixo = util - larguraSufixo;
    // texto que não cabe com o sufixo: o campo reserva o espaço e o texto rola por dentro
    input.style.paddingRight = larguraTexto + larguraSufixo > util ? `${larguraSufixo + 4}px` : '0px';
    campo.style.setProperty('--cursor-x', `${Math.max(0, xCursor).toFixed(1)}px`);
    campo.style.setProperty('--sufixo-x', `${xSufixo.toFixed(1)}px`);
    form?.classList.toggle('is-selecao', fim !== ini);
    // com o cursor no fim do texto, o sufixo abre espaço para o ponto
    form?.classList.toggle('is-fim', valor.length > 0 && ini === valor.length);
  }

  // ---- terminações ----
  type EstadoTld = 'is-livre' | 'is-ocupado' | 'is-procurando' | null;
  function marcar(item: HTMLElement, estado: EstadoTld): void {
    item.classList.remove('is-livre', 'is-ocupado', 'is-procurando');
    if (estado) item.classList.add(estado);
  }
  const textoEstado = (item: HTMLElement, t: string): void => { exigir('.tld__estado', item).textContent = t; };
  const limparSugestoes = (item: HTMLElement): void => { exigir('.tld__sugestoes', item).textContent = ''; };
  const acaoDe = (item: HTMLElement): HTMLButtonElement => exigir<HTMLButtonElement>('.tld__acao', item);
  const escolhida = (item: HTMLElement): boolean => exigir('.tld__escolher', item).getAttribute('aria-pressed') === 'true';

  function sugerir(item: HTMLElement, nome: string, tld: string): void {
    const caixa = exigir('.tld__sugestoes', item);
    caixa.textContent = '';
    const opcoes = [`${nome}-online`, `${nome}oficial`, `meu${nome}`, `${nome}br`, `use${nome}`]
      .filter((n) => n.length <= 40 && disponivel(n, tld)).slice(0, 2);
    opcoes.forEach((n, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sugestao';
      b.style.setProperty('--i', String(i));
      b.textContent = n + tld;
      b.addEventListener('click', () => {
        input.value = n;
        escolherTld(tld);
        aoDigitar(true);
        input.focus({ preventScroll: true });
      });
      caixa.append(b);
    });
  }

  function procurar(nome: string): void {
    timers.forEach(clearTimeout);
    timers = [];
    ultimoNome = nome;
    itens.forEach((item, i) => {
      const tld = item.dataset.tld ?? '';
      const acao = acaoDe(item);
      item.classList.remove('is-no-carrinho');
      trocarRotulo(acao, acao.dataset.acao || 'Registrar');
      limparSugestoes(item);
      acao.disabled = true;
      if (!nome) {
        marcar(item, null);
        textoEstado(item, 'Digite um nome');
        return;
      }
      marcar(item, 'is-procurando');
      textoEstado(item, 'Procurando…');
      timers.push(window.setTimeout(() => {
        const livre = disponivel(nome, tld);
        marcar(item, livre ? 'is-livre' : 'is-ocupado');
        textoEstado(item, livre ? 'Disponível' : 'Já tem dono');
        acao.disabled = !livre;
        if (!livre) sugerir(item, nome, tld);
        if (escolhida(item)) definir({ nome, livre });
      }, 420 + i * 160));
    });
  }

  function aoDigitar(imediato = false): void {
    const { nome, erro: msg } = validar(input.value);
    form?.classList.toggle('is-cheia', input.value.length > 0);
    form?.classList.add('is-digitando');
    clearTimeout(timerDigita);
    timerDigita = window.setTimeout(() => form?.classList.remove('is-digitando'), 650);
    erro.textContent = msg;
    form?.classList.toggle('is-erro', !!msg);
    posicionar();
    if (msg) {
      timers.forEach(clearTimeout);
      for (const item of itens) {
        marcar(item, null);
        textoEstado(item, '—');
        acaoDe(item).disabled = true;
        limparSugestoes(item);
      }
      ultimoNome = null;
      return;
    }
    clearTimeout(timerBusca);
    if (nome === ultimoNome) return;
    if (imediato) procurar(nome);
    else timerBusca = window.setTimeout(() => procurar(nome), 380);
    if (!nome) definir({ nome: '' });
  }

  function escolherTld(tld: string): void {
    for (const item of itens) exigir('.tld__escolher', item).setAttribute('aria-pressed', String(item.dataset.tld === tld));
    sufixoResto.textContent = tld.slice(1); // o primeiro ponto é o que veio do globo
    definir({ tld });
    posicionar();
  }

  input.addEventListener('input', () => aoDigitar());
  for (const ev of ['keyup', 'click', 'select', 'scroll']) input.addEventListener(ev, posicionar);
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) posicionar(); });
  input.addEventListener('focus', () => { form.classList.add('is-focada', 'is-cursor'); posicionar(); });
  input.addEventListener('blur', () => form.classList.remove('is-focada', 'is-cursor'));
  // clicar em qualquer lugar da linha leva ao campo
  exigir('.busca__linha', form).addEventListener('click', (e) => {
    if (!(e.target instanceof Element && e.target.closest('button'))) input.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { nome, erro: msg } = validar(input.value);
    if (!input.value.trim() || msg) {
      erro.textContent = msg || 'Digite o nome do seu projeto.';
      form.classList.add('is-erro', 'is-treme');
      setTimeout(() => form.classList.remove('is-treme'), 450);
      input.focus();
      return;
    }
    procurar(nome);
  });

  for (const item of itens) {
    const tld = item.dataset.tld ?? '';
    exigir('.tld__escolher', item).addEventListener('click', () => escolherTld(tld));
    const acao = acaoDe(item);
    acao.addEventListener('click', () => {
      escolherTld(tld);
      const jaEsta = item.classList.toggle('is-no-carrinho');
      // os rótulos vêm do HTML (data-acao e data-feito no .tld__acao)
      trocarRotulo(acao, jaEsta ? (acao.dataset.feito || 'No carrinho') : (acao.dataset.acao || 'Registrar'));
      if (jaEsta) definir({ nome: ultimoNome || ler().nome });
    });
  }

  window.addEventListener('resize', posicionar);
  void document.fonts.ready.then(posicionar);
  posicionar();

  return {
    luz: exigir('.busca__luz', sufixo),
    pousar: (sim) => form.classList.toggle('is-pousado', sim),
  };
}
