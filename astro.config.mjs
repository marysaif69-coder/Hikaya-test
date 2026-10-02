import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hikayacoffee.ca',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
