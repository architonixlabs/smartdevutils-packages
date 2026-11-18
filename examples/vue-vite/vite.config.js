import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  // Tell Vue that <sdu-*> tags are custom elements, not Vue components.
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sdu-') } } })],
  base: './',
  // Mermaid's lazy chunks are large; they load only when a diagram is drawn.
  build: { chunkSizeWarningLimit: 2000 },
})
