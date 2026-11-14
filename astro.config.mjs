// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // /lab fue la ruta de la v2 mientras era un laboratorio (sprint 20).
  redirects: { '/lab': '/' },
  vite: {
    plugins: [tailwindcss()]
  }
});
