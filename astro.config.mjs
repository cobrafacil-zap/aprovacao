// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Configuração do site da Elisângela Tomba — Deputada Estadual PT/Paraná 2026
// Stack: Astro (gerador estático) + Decap CMS (admin /admin) + Cloudflare R2 (imagens)
// Hospedagem final: Localweb (arquivos estáticos enviados via FTP/gerenciador)

export default defineConfig({
  site: 'https://www.elisangelatomba.com.br',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
    assets: '_assets',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
    }),
  ],
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  image: {
    // Astro v5 já tem image() nativo, sem necessidade de serviço
  },
  vite: {
    build: {
      cssMinify: 'esbuild',
    },
  },
});
