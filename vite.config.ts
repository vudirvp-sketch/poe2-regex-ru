/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const aliasConfig = {
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@store': path.resolve(__dirname, './src/store'),
      '@data': path.resolve(__dirname, './src/data'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@strategies': path.resolve(__dirname, './src/strategies'),
      '@etl': path.resolve(__dirname, './scripts/etl'),
    },
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  ...aliasConfig,
  plugins: [react(), tailwindcss()],
  base: '/poe2-regex-ru/',
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    // React component tests need jsdom; unit tests default to node
    // Per-file override: add `// @vitest-environment jsdom` at top of test file
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    ...aliasConfig,
  },
})
