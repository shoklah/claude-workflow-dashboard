import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The dashboard server the dev server proxies `/api` to: the config's default port unless PORT is set, as in
// dev:fixtures. Host and Origin are rewritten to the server's, so its request rules hold in development too.
const api = `http://localhost:${process.env.PORT ?? 4317}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Every `cn` import gets the one taught the theme's scales (`src/lib/utils.ts`); `cn/config` stays the package.
      { find: /^cn$/, replacement: fileURLToPath(new URL('./src/lib/utils.ts', import.meta.url)) },
    ],
  },
  server: { proxy: { '/api': { target: api, changeOrigin: true, headers: { Origin: api } } } },
});
