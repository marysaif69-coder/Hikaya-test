import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hikayacoffee.ca',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({
    // No team pages, no root redirect, no cart/checkout/thanks/account, no 404.
    filter: page => { const p = new URL(page).pathname; return p !== '/' && !p.startsWith('/admin/') && !/\/(cart|checkout|thanks|account)\/$/.test(p) && !p.endsWith('/404/'); },
    i18n: { defaultLocale: 'en', locales: { en: 'en-CA', ar: 'ar' } },
  })],
});
