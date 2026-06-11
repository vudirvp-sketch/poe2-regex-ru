/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/poe2-regex-ru/',
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
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
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
  },
})
