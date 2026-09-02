import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'siges-production-api-url',
      transform(code, id) {
        if (command === 'build' && id.endsWith('/src/main.jsx')) {
          return {
            code: code.replaceAll("http://localhost:3001/api", "/api"),
            map: null
          };
        }
      }
    }
  ],
  build: {
    outDir: 'dist'
  }
}));
