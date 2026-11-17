import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE is set by the GitHub Pages workflow (the site lives under /tickerline/).
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [react()],
  server: { port: 4200 },
  test: { environment: 'node' },
});
