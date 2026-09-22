import { defineConfig } from 'vitest/config';

export default defineConfig({
  tsconfig: './tsconfig.vitest.json',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
