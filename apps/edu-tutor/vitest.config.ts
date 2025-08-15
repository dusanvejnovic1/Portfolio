import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})