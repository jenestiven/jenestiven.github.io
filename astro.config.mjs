// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Sitio de usuario de GitHub Pages: se sirve en la raíz, sin `base`.
  site: 'https://jenestiven.github.io',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()]
  }
});
