import { defineConfig } from 'vitest/config'

// Logic tests only (no Angular TestBed): docs generator, snippet execution, compile, protocol, share links.
// Keep testable logic in decorator-free modules.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
