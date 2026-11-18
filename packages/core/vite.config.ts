import { readdirSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { externalsFor } from '../../scripts/externals.mjs'

const modules = [
  'encoding', 'formatting', 'hashing', 'generation', 'text',
  'formats', 'jwt', 'dba', 'devops', 'aiml', 'security',
  'database', 'devops-tools', 'aiml-tools', 'planning',
  'color', 'network', 'data', 'text-extra', 'developer', 'security-extra2',
]

// One entry per tool runner, so @smartdevutils/core/tools/<id> loads only that tool.
const runners = readdirSync(resolve(__dirname, 'src/tools/runners'))
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map(f => f.slice(0, -3))

export default defineConfig({
  plugins: [
    dts({ include: ['src'], outDir: 'dist', rollupTypes: false }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        ...Object.fromEntries(modules.map(m => [m, resolve(__dirname, `src/${m}.ts`)])),
        'tools/index': resolve(__dirname, 'src/tools/index.ts'),
        'tools/catalog-entry': resolve(__dirname, 'src/tools/catalog-entry.ts'),
        'diagrams/index': resolve(__dirname, 'src/diagrams/index.ts'),
        ...Object.fromEntries(runners.map(r => [`tools/runners/${r}`, resolve(__dirname, `src/tools/runners/${r}.ts`)])),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      output: { exports: 'named' },
      // The EFF word list is plain JSON data: bundle it so Node can load our ESM build without import attributes.
      external: externalsFor(resolve(__dirname, 'package.json'), { inline: ['eff-diceware-passphrase/wordlist.json'] }),
    },
    sourcemap: true,
    minify: false,
  },
})
