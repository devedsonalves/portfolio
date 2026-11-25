# Portfólio — Edson Alves

Portfólio de desenvolvedor full-stack. **Vite + TypeScript (strict) + Tailwind v4**, sem framework de UI. Three.js para o globo 3D do hero e Lenis na roda do mouse: **sem GSAP, sem pin, nada prende a página**. A régua é site de premiação: se uma passagem parece "ok", ainda não está pronta.

O impacto vem de três coisas: o hero com o globo 3D subindo **por cima** da palavra gigante "Código"; o globo que gira com a mão, acompanha a descida e **solta um ponto aceso que pousa no ponto do ".com" da busca**; e a página inteira numa noite só, com o nome digitado pelo visitante voltando no fecho.

## Comandos
- `npm run dev` — porta 5183
- `npm run typecheck` — `tsc` do app e do `vite.config.ts`
- `npm run build` — typecheck + build em `dist/` (base relativa: abre em qualquer pasta da hospedagem)
- `npm run preview`

## Estrutura
```
index.html              <head>, camadas fixas (canvas, cidades, ponto que voa, barra, cursor) e a ordem das seções
vite.config.ts          plugin "secoes": <!-- @secao hero --> vira src/sections/hero/hero.html
src/
  main.ts               a ordem de inicialização; o Three.js vem por import() depois da página
  core/                 rolagem.ts (Lenis + o único requestAnimationFrame + suavizações), layout.ts (medidas, L),
                        revelar.ts (texto que entra por IntersectionObserver), estado.ts (nome/terminação/serviço),
                        dom.ts ($, $$, exigir)
  cena/                 o 3D: globo.ts (o laptop: modelo, teclas que acendem, interface Globo), tela.ts (o editor que se digita
                        na tela e o mapa das teclas), coreografia.ts (roteiro pela
                        rolagem), arrasto.ts (girar com a mão), voo.ts (o ponto até a busca)
  ui/                   barra.ts (barra de rolagem própria), cursor.ts (cursor próprio), toque.ts (hover x rolagem/toque)
  sections/<nome>/      <nome>.html + <nome>.css (+ o .ts da seção, quando tem comportamento)
  styles/               main.css (entrada), tokens.css (@theme), base.css, componentes.css, cursor.css
public/                 favicon, img/ (WebP nos tamanhos usados), models/laptop.glb, textures/ (o relevo 2048 vira a máscara do mapa na tela)
fonte/                  material bruto (não vai para o site): o retrato original e os
                        scripts Python que geram as texturas do globo e os retratos em WebP
```

A ordem da página segue a do menu: hero, regioes, Experiência, Projetos, Serviços, Sobre, Contato e o rodapé.

| seção | o que é | TS |
|---|---|---|
| `nav` | links, marca, menu de tela cheia no celular | `nav.ts` |
| `hero` | o nome gigante, o texto, os botões | medidas em `core/layout.ts`, giro em `cena/arrasto.ts` |
| `regioes` | as duas frases ao lado do laptop (quem faz, e o depois do ar); `data-falha` num bloco liga a cidade que cai | `cena/coreografia.ts` |
| `experiencia` | uma linha por emprego | — |
| `projetos` | uma linha por projeto (links) | — |
| `servicos` | os serviços em tipografia (`.servico` com `data-servico` e `data-preco`) e o resumo | `servicos.ts` |
| `sobre` | retrato, texto, stack | — |
| `contato` | status, texto, o e-mail gigante (copiar), WhatsApp e formulário | `contato.ts` |
| `rodape` | status, colunas de links, legal | — |

Tirar uma seção: apague a linha `<!-- @secao nome -->` do `index.html` e o `@import` da folha em `main.css`; cada módulo confere se a seção dele existe. Confira os links `href="#..."` que apontavam para ela. Seção nova: `src/sections/<nome>/<nome>.html` com `data-secao`, a folha importada em `main.css` com `layer(components)`, título com as linhas em `<span class="linha"><span>…</span></span>` dentro de um bloco com `data-revela`.

## CSS e Tailwind
- **Folha única** `src/styles/main.css`, ligada por `<link>` no `<head>`. Nunca importe CSS pelo TS (no dev ele chega depois e a página pinta crua).
- **Camadas**: `theme` (tokens) → `base` (reset próprio; o preflight do Tailwind fica desligado) → `components` (componentes e uma folha por seção, em BEM) → `utilities` (classes do Tailwind, que vencem os componentes).
- **Tokens** em `tokens.css`, no `@theme` do Tailwind, com os padrões zerados (não existe cor fora da lista): `--color-preto-topo/preto/preto-fim`, `--color-fantasma`, `--color-tinta/tinta-2/tinta-3`, `--color-fio/fio-forte`, **`--color-acento`** (o único acento) e `-claro`/`-brilho`, `--color-sobre-acento`, `--color-apagado`; `--font-sans`; `--text-titulo/lead/corpo/ui/pequeno`; `--spacing-margem`, `--spacing-gap`; `--ease-out/io/snap`; `--radius-pilula`. Viram utilitárias (`text-tinta`, `px-margem`, `ease-snap`). Nunca cor solta; transparência é `color-mix(in srgb, var(--color-tinta) 14%, transparent)`.
- Variante própria `celular:` (abaixo de 760 px). O Tailwind só procura classes no HTML (`@source` em `main.css`).
- O globo lê `--color-acento`: trocar a cor ali troca os pontos acesos. Ao mudar o preto, mude também o fundo inline do `<head>`.

## Design
- O acento é **luz**, não cor de bloco: pontos do globo, o ponto do ".com", cursor da busca, serviço escolhido, ponto "no ar", fio em foco, erro, anel de foco.
- **Uma família**: Archivo variável com eixo de largura. Palavras gigantes, marca, nomes de serviço e números a 125%; títulos a 118% (2 linhas no máximo, `.linha` + `nowrap`); lead a 108%; corpo a 100%; interface a 104%. Nada abaixo de 12,5 px.
- Grade de 12 colunas. Pouco texto, muito ar, uma ideia por seção. Proibido: grade de cards, HUD, "role para baixo", rótulos com traço, selos.
- Camadas: o canvas é fixo em `z-index: 1`; a palavra gigante em `z-index: 0`; o resto do conteúdo em `z-index: 2`. `main`, `section` e `footer` nunca recebem `transform`, `opacity`, `filter` ou `z-index`.

## Movimento
- **Rolagem solta.** O Lenis só suaviza a roda do mouse (o toque é o nativo), no mesmo `requestAnimationFrame` de tudo (`core/rolagem.ts`).
- **O scroll dirige só imagem** (globo, ponto que voa, parallax das fotos), com suavização exponencial pelo tempo (`amortecer`).
- **Texto entra por tempo**, uma vez (`core/revelar.ts`): linhas sobem da máscara em 0,9 s `--ease-out`, 70 ms entre elas; parágrafos e botões sobem 14 px com fade. Nunca texto scrubado; nunca letra comida pela máscara.
- Curvas só dos tokens (`--ease-out`, `--ease-io`, `--ease-snap`). Nada de `ease` padrão.
- O globo nunca cobre texto. Rolando rápido e voltando, tudo assenta no estado final.
- `prefers-reduced-motion`: sem balanço nem suavização, ponto já pousado, textos sem deslocamento, sem parallax, sem piscar, sem Lenis, sem girar com a mão.
- Todo clicável tem hover, foco visível e clique; hover desligado durante a rolagem (`.is-scrolling`) e o mesmo estado no toque (`.is-toque`). Formulários com foco, preenchido, erro (mensagem e tremida) e enviado.

## Celular
- Nunca rolar para o lado. Alvos de toque de 44 px. Arrasto vertical em cima do globo rola a página.
- Conferir em 390 × 844 e 375 × 553.

## Desempenho
- 60 fps; `devicePixelRatio` até 2; o globo só desenha enquanto está na tela; Three.js por `import()` dinâmico.
- Fotos em WebP no tamanho em que aparecem (`srcset`), `loading="lazy"`.

## Como checar
1. `npm run dev`; olhar a 1456 × 840 e a 390 × 844.
2. Recarregar: "Código" aparece, o texto sobe, o globo surge e as cidades acendem de oeste para leste. Arrastar o globo (mouse e dedo).
3. Rolar até a busca: as frases passam ao lado; "Uma cai, outra segura." apaga uma cidade e acende a vizinha; o ponto cai e pousa no ".com".
4. Busca: digitar um nome, ver "Procurando…", disponível/ocupado, sugestões; "minha loja" dá erro.
5. Serviços: escolher outro, conferir o resumo e o fecho com o nome digitado.
6. Contato: enviar vazio (erros), preencher e enviar (enviando → enviado).
7. Rolar rápido e voltar; repetir com movimento reduzido; menu do celular; percorrer com Tab.
8. Console sem erros; `npm run build` passa; testar o `dist/` numa subpasta com um servidor estático de verdade (`python -m http.server`), sem 404.

## O que ainda é provisório
- Projetos (2026): Margem e Finora têm descrição e stack; o Bivvo mostra "Stack em definição" até a stack sair; falta `[preencher]` o link de cada um.
- Links do currículo (`#`) em `sobre.html` e `rodape.html`: falta o PDF em `public/`.
- Os formulários são fictícios: `contato.ts` (envio) e `busca.ts` (`disponivel()`) precisam de destino real.
- A foto de banco do contato saiu da página (os arquivos `public/img/contato-*.webp` ficaram sem uso).
- Fato nunca se inventa: número, data ou empresa que não vieram do Edson ficam `[preencher]`.

## Créditos
- Laptop: `public/models/laptop.glb` (exportado do Blender). A tela usa o material `laptop.monitor`; a tampa é o nó `monitor`. [preencher] autor e licença do modelo.
- Globo: Blue Marble Next Generation e relevo/batimetria GEBCO 2008, NASA Visible Earth (domínio público). Regenerar: baixar os arquivos listados em `fonte/scripts/texturas.py` para `fonte/nasa/` (fora do git) e rodar `python fonte/scripts/texturas.py` (precisa de `pillow` e `numpy`).
- Retrato: `fonte/fotos/edson.png`, tratado por `python fonte/scripts/retrato.py`.
