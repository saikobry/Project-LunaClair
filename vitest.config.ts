import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { unplugin } from '@stylexjs/unplugin';

export default defineConfig({
  plugins: [
    unplugin.vite(),
    react(),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
