import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@smartdevutils/core/hashing': resolve(__dirname, '../core/dist/hashing.cjs'),
      '@smartdevutils/core/security': resolve(__dirname, '../core/dist/security-extra.cjs'),
    },
  },
  test: {
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
