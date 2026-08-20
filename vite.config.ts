import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@huggingface/transformers')) return 'transformers';
          if (id.includes('@ffmpeg')) return 'ffmpeg';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
  worker: { format: 'es' },
});
