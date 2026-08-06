import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/integration/api/global-setup.ts'],
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
