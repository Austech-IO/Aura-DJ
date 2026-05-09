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
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-motion': ['framer-motion', 'motion/react'],
            'vendor-icons': ['lucide-react'],
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
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
    }
  };
});
