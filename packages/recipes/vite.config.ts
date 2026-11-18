import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externalsFor } from '../../scripts/externals.mjs'

export default defineConfig({
  plugins: [dts({ include: ['src'], outDir: 'dist', rollupTypes: false })],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      output: { exports: 'named' },
      external: externalsFor(resolve(__dirname, 'package.json')),
    },
    sourcemap: true,
    minify: false,
  },
})
