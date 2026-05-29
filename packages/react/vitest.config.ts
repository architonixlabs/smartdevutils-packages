import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const coreDistPath = resolve(__dirname, '../core/dist')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@smartdevutils/core/encoding': `${coreDistPath}/encoding.cjs`,
      '@smartdevutils/core/formatting': `${coreDistPath}/formatting.cjs`,
      '@smartdevutils/core/hashing': `${coreDistPath}/hashing.cjs`,
      '@smartdevutils/core/generation': `${coreDistPath}/generation.cjs`,
      '@smartdevutils/core/text': `${coreDistPath}/text.cjs`,
      '@smartdevutils/core/formats': `${coreDistPath}/formats.cjs`,
      '@smartdevutils/core/jwt': `${coreDistPath}/jwt.cjs`,
      '@smartdevutils/core/dba': `${coreDistPath}/dba.cjs`,
      '@smartdevutils/core/devops': `${coreDistPath}/devops.cjs`,
      '@smartdevutils/core/aiml': `${coreDistPath}/aiml.cjs`,
      '@smartdevutils/core/security': `${coreDistPath}/security-extra.cjs`,
      '@smartdevutils/core/database': `${coreDistPath}/database.cjs`,
      '@smartdevutils/core/devops-tools': `${coreDistPath}/devops-tools.cjs`,
      '@smartdevutils/core/aiml-tools': `${coreDistPath}/aiml-tools.cjs`,
      '@smartdevutils/core/planning': `${coreDistPath}/planning.cjs`,
      '@smartdevutils/core': `${coreDistPath}/index.cjs`,
    },
  },
  test: {
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
