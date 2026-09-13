// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // SheetJS is only imported lazily (first Excel click). Pre-bundle it up front so the dev server
    // never has to re-optimise mid-session, which surfaced as "504 Outdated Optimize Dep" on click.
    optimizeDeps: { include: ['xlsx'] }
  }
});