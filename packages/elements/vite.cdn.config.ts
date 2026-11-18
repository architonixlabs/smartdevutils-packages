import { resolve } from 'path'
import { defineConfig } from 'vite'

// The CDN build: dist/cdn/sdu-elements.js registers every element. Lit and the theme are inside it.
// Each tool runner, the recipe engine and its tool catalog are separate chunks in dist/cdn/chunks/,
// fetched the first time an element needs them. Mermaid is never bundled (see setMermaidUrl).
export default defineConfig({
  build: {
    outDir: 'dist/cdn',
    emptyOutDir: true,
    lib: {
      entry: { 'sdu-elements': resolve(__dirname, 'src/cdn.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    target: 'es2021',
    minify: 'esbuild',
    sourcemap: true,
  },
})
