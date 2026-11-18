import { createApp } from 'vue'
// Registers <sdu-tool>, <sdu-diagram>, <sdu-recipe>, <sdu-recipe-run> and the named tool elements.
import { setMermaidLoader } from '@smartdevutils/elements'
import App from './App.vue'

// Use the installed mermaid package (bundled by Vite as a lazy chunk) instead of the CDN copy.
setMermaidLoader(() => import('mermaid'))

createApp(App).mount('#app')
