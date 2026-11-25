// O ponto que se solta do globo e pousa no ponto do ".com" da busca de domínio.
// Segue a rolagem (é imagem, não texto): ida e volta no mesmo caminho, sem prender nada.
import { $ } from '../core/dom.ts';
import { L } from '../core/layout.ts';
import { faixa, misturar, reduzido, tela } from '../core/rolagem.ts';
import type { Busca } from '../sections/dominio/busca.ts';
import type { Coreografia } from './coreografia.ts';
import { type Globo, PAPEIS, type Projecao } from './globo.ts';

// o ponto que voa: data-voa na lista de regiões do index.html
const IDX = PAPEIS.voa;
const curva = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Fase = 'globo' | 'voando' | 'pousado';

export function criarVoo(globo: Globo, coreografia: Coreografia, busca: Busca | null): { quadro(): void } {
  const el = $('.ponto-voo');
  // sem a busca de domínio (ou sem o ponto), não há para onde voar
  if (!el || !busca) return { quadro() {} };
  const { luz } = busca;
  const p: Projecao = { x: 0, y: 0, face: 0 };
  let fase: Fase = 'globo';

  function mudar(nova: Fase): void {
    if (nova === fase) return;
    fase = nova;
    el?.classList.toggle('is-voando', nova === 'voando');
    coreografia.segurar(IDX, nova !== 'globo');
    busca?.pousar(nova === 'pousado');
  }

  function quadro(): void {
    if (!L.busca || !el) return;
    if (reduzido) {
      mudar(tela.y > L.busca.topo - tela.h ? 'pousado' : 'globo');
      return;
    }
    // começa quando a seção de regiões termina (sem ela, quando o hero termina)
    const antes = L.regioes ? L.regioes.topo + L.regioes.altura : (L.hero?.altura ?? 0);
    const s0 = antes - tela.h * (tela.celular ? 1.05 : 0.8);
    const s1 = L.busca.topo - tela.h * (tela.celular ? 0.58 : 0.62);
    const t = faixa(tela.y, s0, s1);
    if (t <= 0) { mudar('globo'); return; }
    if (t >= 1) { mudar('pousado'); return; }
    mudar('voando');
    globo.projetar(IDX, p);
    const c = luz.getBoundingClientRect();
    const x1 = c.left + c.width / 2;
    const y1 = c.top + c.height / 2;
    const e = curva(t);
    // desce pelo vão à direita do título e cai na vertical no ponto do ".com", entre as letras (curva de Bézier)
    const cx = x1;
    const cy = Math.min(p.y, y1 - tela.h * 0.3);
    const u = 1 - e;
    const x = u * u * p.x + 2 * u * e * cx + e * e * x1;
    const y = u * u * p.y + 2 * u * e * cy + e * e * y1;
    const tam = misturar(7, c.width || 10, e);
    el.style.transform = `translate3d(${(x - tam / 2).toFixed(1)}px, ${(y - tam / 2).toFixed(1)}px, 0)`;
    el.style.width = el.style.height = `${tam.toFixed(1)}px`;
  }

  return { quadro };
}
