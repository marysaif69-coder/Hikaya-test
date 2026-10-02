import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hikayacoffee.ca',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({
    filter: page => !/\/(cart|checkout|thanks)\/$/.test(page) && !page.endsWith('/404/'),
    i18n: { defaultLocale: 'en', locales: { en: 'en-CA', ar: 'ar' } },
  })],
});
