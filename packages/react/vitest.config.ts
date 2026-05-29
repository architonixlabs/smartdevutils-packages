import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const coreDistPath = resolve(__dirname, '../core/dist')
const browserDistPath = resolve(__dirname, '../browser/dist')

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
      '@smartdevutils/core/security': `${coreDistPath}/security.cjs`,
      '@smartdevutils/core/database': `${coreDistPath}/database.cjs`,
      '@smartdevutils/core/devops-tools': `${coreDistPath}/devops-tools.cjs`,
      '@smartdevutils/core/aiml-tools': `${coreDistPath}/aiml-tools.cjs`,
      '@smartdevutils/core/planning': `${coreDistPath}/planning.cjs`,
      '@smartdevutils/core/color': `${coreDistPath}/color.cjs`,
      '@smartdevutils/core/network': `${coreDistPath}/network.cjs`,
      '@smartdevutils/core/data': `${coreDistPath}/data.cjs`,
      '@smartdevutils/core/developer': `${coreDistPath}/developer.cjs`,
      '@smartdevutils/core/security-extra2': `${coreDistPath}/security-extra2.cjs`,
      '@smartdevutils/core/text-extra': `${coreDistPath}/text-extra.cjs`,
      '@smartdevutils/core': `${coreDistPath}/index.cjs`,
      '@smartdevutils/browser/color-blindness': `${browserDistPath}/color-blindness.cjs`,
      '@smartdevutils/browser/file': `${browserDistPath}/file.cjs`,
      '@smartdevutils/browser/clipboard': `${browserDistPath}/clipboard.cjs`,
      '@smartdevutils/browser/qrcode': `${browserDistPath}/qrcode.cjs`,
      '@smartdevutils/browser/user-agent': `${browserDistPath}/user-agent.cjs`,
      '@smartdevutils/browser': `${browserDistPath}/index.cjs`,
    },
  },
  test: {
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
