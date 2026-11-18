import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externalsFor } from '../../scripts/externals.mjs'

const entries = ['index', 'tool', 'tools', 'diagram', 'recipe', 'recipe-run']

// The npm build: one ES module per element. Lit, the theme and the other @smartdevutils packages stay
// imports, so your bundler shares one copy of each.
export default defineConfig({
  plugins: [dts({ include: ['src'], exclude: ['src/**/*.test.ts', 'src/cdn.ts'], outDir: 'dist', rollupTypes: false })],
  build: {
    lib: {
      entry: Object.fromEntries(entries.map((e) => [e, resolve(__dirname, `src/${e}.ts`)])),
      formats: ['es'],
    },
    rollupOptions: {
      external: externalsFor(resolve(__dirname, 'package.json')),
    },
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
  },
})
