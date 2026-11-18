import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Mermaid's lazy chunks are large; they load only when a diagram is drawn.
export default defineConfig({ plugins: [react()], base: './', build: { chunkSizeWarningLimit: 2000 } })
