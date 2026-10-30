import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    host: true,
    port: 5233,
    strictPort: true,
    proxy: { '/ws': { target: `ws://localhost:${process.env.GL_WS_PORT || 8091}`, ws: true } },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), blueprint: resolve(import.meta.dirname, 'blueprint.html') },
    },
  },
});
