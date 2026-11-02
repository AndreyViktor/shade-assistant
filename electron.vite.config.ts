import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { build: { outDir: 'dist/main' } },
  renderer: {
    plugins: [
      react(),
      {
        name: 'local-development-csp',
        apply: 'serve',
        transformIndexHtml(html) {
          // Vite/React inject styles and the refresh preamble only during development.
          return html.replace(
            "script-src 'self'; style-src 'self'; connect-src 'none'",
            "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173",
          );
        },
      },
    ],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    build: { outDir: 'dist/renderer' },
  },
});
