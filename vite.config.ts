import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      command === 'serve'
        ? {
            name: 'api-server-middleware',
            async configureServer(server) {
              const { app } = await import('./server/server.ts');
              server.middlewares.use((req, res, next) => {
                if (req.url?.startsWith('/api')) {
                  (app as any)(req, res, next);
                } else {
                  next();
                }
              });
            }
          }
        : null
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react'],
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

