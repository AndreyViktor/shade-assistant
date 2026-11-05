import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/tooling/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/manual/**/*.test.ts',
    ],
    setupFiles: ['tests/setup.ts'],
    clearMocks: true,
  },
});
