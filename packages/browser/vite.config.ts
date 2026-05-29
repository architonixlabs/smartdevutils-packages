import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const modules = ['qrcode', 'clipboard', 'color-blindness', 'file', 'accessibility', 'user-agent']

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
      external: ['@smartdevutils/core'],
    },
    sourcemap: true,
    minify: false,
  },
})
