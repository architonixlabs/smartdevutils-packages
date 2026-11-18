import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.mjs'],
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
    },
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
