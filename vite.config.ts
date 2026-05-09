import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const disableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('framer-motion') || id.includes('motion/react')) return 'vendor-motion';
              if (id.includes('react')) return 'vendor-react';
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      // Disable HMR entirely when DISABLE_HMR=true (AI Studio / sandboxed envs).
      // When enabled, use a short timeout so failed WS connections fail fast
      // instead of leaving an unhandled rejection floating in the console.
      hmr: disableHmr ? false : { timeout: 5000 },
    },
  };
});
