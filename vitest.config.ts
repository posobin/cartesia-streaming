import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '#api': new URL('./src/api', import.meta.url).pathname,
      '#commands': new URL('./src/commands', import.meta.url).pathname,
      '#domains': new URL('./src/domains', import.meta.url).pathname,
      '#integrations': new URL('./src/integrations', import.meta.url).pathname,
      '#parsing': new URL('./src/parsing', import.meta.url).pathname,
      '#services': new URL('./src/services', import.meta.url).pathname,
      '#socket': new URL('./src/socket', import.meta.url).pathname,
      '#types': new URL('./src/types', import.meta.url).pathname,
      '#logger': new URL('./src/logger.js', import.meta.url).pathname,
      '#env': new URL('./src/env.js', import.meta.url).pathname,
      '#js-utils': new URL('./src/js-utils', import.meta.url).pathname,
    },
  },
});
