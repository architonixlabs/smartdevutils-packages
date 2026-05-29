import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const modules = [
  'encoding', 'formatting', 'hashing', 'generation', 'text',
  'formats', 'jwt', 'dba', 'devops', 'aiml', 'security',
  'database', 'devops-tools', 'aiml-tools', 'planning',
  'color', 'network', 'data', 'text-extra', 'developer', 'security-extra2',
]

export default defineConfig({
  plugins: [
    dts({ include: ['src'], outDir: 'dist', rollupTypes: false }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        ...Object.fromEntries(modules.map(m => [m, resolve(__dirname, `src/${m}.ts`)])),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
    minify: false,
  },
})
