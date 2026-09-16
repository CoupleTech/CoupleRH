import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Simulando o backend de cálculo
    include: ['src/tests/**/*.test.ts'],
  },
});
