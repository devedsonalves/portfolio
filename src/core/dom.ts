// Atalhos tipados para o DOM. Cada módulo confere se a seção dele existe: $ devolve null quando não acha.

export function $<T extends Element = HTMLElement>(seletor: string, raiz: ParentNode = document): T | null {
  return raiz.querySelector<T>(seletor);
}

export function $$<T extends Element = HTMLElement>(seletor: string, raiz: ParentNode = document): T[] {
  return [...raiz.querySelectorAll<T>(seletor)];
}

/** o elemento que existe sem falta dentro de uma seção que já existe (erro de HTML se faltar) */
export function exigir<T extends Element = HTMLElement>(seletor: string, raiz: ParentNode = document): T {
  const el = raiz.querySelector<T>(seletor);
  if (!el) throw new Error(`Faltou ${seletor} no HTML`);
  return el;
}

/** troca o texto do rótulo que rola dos botões (.rola__a e .rola__b) */
export function trocarRotulo(raiz: ParentNode, texto: string): void {
  for (const s of $$('.rola__a, .rola__b', raiz)) s.textContent = texto;
}
