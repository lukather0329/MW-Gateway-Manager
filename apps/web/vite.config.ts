import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev ports are date-derived (today: 2026-08-07 -> 608xx), not the common
// framework default (5173/3000/...), since those collide across the many
// local projects on this machine. Backend uses 60807 (see apps/server/.env);
// this app uses 60817 so the two never collide with each other either.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 60817,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:60807',
        changeOrigin: true,
      },
    },
  },
});
