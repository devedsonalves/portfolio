import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

// Uma seção por pasta: <!-- @secao hero --> no index.html vira o conteúdo de src/sections/hero/hero.html
// (vale dentro das próprias seções). Sem a linha, a seção sai da página e o módulo dela não faz nada.
const MARCA = /<!--\s*@secao\s+([\w-]+)\s*-->/g;
const SECOES = resolve(import.meta.dirname, 'src/sections');

const inclui = (html: string): string =>
  html.replace(MARCA, (_, nome: string) => inclui(readFileSync(resolve(SECOES, nome, `${nome}.html`), 'utf8')));

function secoes(): Plugin {
  return {
    name: 'secoes',
    transformIndexHtml: { order: 'pre', handler: inclui },
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/sections/') && file.endsWith('.html')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  plugins: [secoes(), tailwindcss()],
  // base relativa: o dist/ abre em qualquer pasta da hospedagem, não só na raiz do domínio
  base: './',
  server: { port: 5183, strictPort: true },
  preview: { port: 5183, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // o Three.js vem num pedaço próprio, carregado depois da página (import dinâmico em main.ts)
    chunkSizeWarningLimit: 800,
  },
});
