// O fio do meio da página: o nome que o visitante digita na busca, a terminação e o serviço que escolhe seguem
// para o resumo dos serviços e para o fecho.
// Os serviços, o marcado e a terminação marcada vêm do HTML (sections/servicos e sections/dominio): o nome de cada
// serviço é o texto de .servico__nome, o marcado é o que tem aria-checked="true", a terminação é a de aria-pressed.
import { $, $$ } from './dom.ts';

export interface Estado {
  nome: string;
  tld: string;
  /** o id do serviço escolhido (data-servico) */
  servico: string;
  /** se o nome digitado está livre na terminação escolhida */
  livre?: boolean;
}

export interface Servico {
  nome: string;
  /** o preço como está no HTML: um número ("39,90") ou um texto ("sob consulta") */
  preco: string;
}

export const SERVICOS: Record<string, Servico> = {};
for (const l of $$('[data-servicos] .servico')) {
  const id = l.dataset.servico ?? '';
  SERVICOS[id] = {
    nome: $('.servico__nome', l)?.textContent?.trim() ?? id,
    preco: l.dataset.preco ?? '',
  };
}

const marcado = $('[data-servicos] .servico[aria-checked="true"]') ?? $('[data-servicos] .servico');
const tldMarcada = $('[data-tlds] .tld__escolher[aria-pressed="true"]')?.closest<HTMLElement>('.tld') ?? $('[data-tlds] .tld');
// o nome de exemplo é o placeholder da busca ("seunegocio"); sem a busca, o domínio escrito no resumo ou no fecho
const escrito = $('[data-dominio]')?.textContent?.trim() ?? '';
const exemplo = $<HTMLInputElement>('.busca__input')?.placeholder || escrito.split('.')[0] || 'seunegocio';

const estado: Estado = {
  nome: '',
  tld: tldMarcada?.dataset.tld ?? (escrito.includes('.') ? escrito.slice(escrito.indexOf('.')) : '.com.br'),
  servico: marcado?.dataset.servico ?? '',
};

type Ouvinte = (e: Readonly<Estado>) => void;
const ouvintes = new Set<Ouvinte>();

export function definir(parcial: Partial<Estado>): void {
  Object.assign(estado, parcial);
  ouvintes.forEach((f) => f(estado));
}

/** chama f agora e a cada mudança */
export function ouvir(f: Ouvinte): void {
  ouvintes.add(f);
  f(estado);
}

export const ler = (): Readonly<Estado> => estado;
export const dominio = (e: Readonly<Estado>): string => `${e.nome || exemplo}${e.tld}`;
