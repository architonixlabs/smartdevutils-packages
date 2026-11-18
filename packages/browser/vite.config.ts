import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externalsFor } from '../../scripts/externals.mjs'

const modules = ['qrcode', 'clipboard', 'color-blindness', 'file', 'accessibility', 'user-agent', 'mermaid']

export default defineConfig({
  plugins: [dts({ include: ['src'], outDir: 'dist', rollupTypes: false })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        ...Object.fromEntries(modules.map(m => [m, resolve(__dirname, `src/${m}.ts`)])),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: externalsFor(resolve(__dirname, 'package.json')),
    },
    sourcemap: true,
    minify: false,
  },
})
