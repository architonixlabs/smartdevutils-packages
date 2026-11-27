// Builds the self-hosted runtime the sandbox imports through an import map:
//   public/runtime/<entry>-<hash>.js   one ES module per public specifier, shared chunks under chunks/
//   public/runtime/importmap.json      { imports: { "<specifier>": "./<file>" } } (relative to this file)
//   public/runtime/theme/*.css         @smartdevutils/theme stylesheets
//   public/sandbox.js                  the sandbox page script (classic script, built from runtime/sandbox.ts)
// Run: pnpm --filter @smartdevutils-apps/playground runtime (part of `build`).
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, defineConfig, type Plugin } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const packagesDir = resolve(here, '../../packages')
const outDir = resolve(here, 'public/runtime')
const require = createRequire(join(here, 'package.json'))

type PackageJson = { exports?: Record<string, unknown> }
const readPkg = (dir: string): PackageJson =>
  JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')) as PackageJson

/** Public specifier → rollup entry name (also its output path without hash). */
const entries = new Map<string, string>()

/** Wildcard subpath (core "./tools/*" → dist/tools/runners/*.js): one entry per matching file. */
function addWildcard(dir: string, key: string, target: string): void {
  const [folderPath, suffix] = target.split('*') as [string, string]
  for (const file of readdirSync(join(packagesDir, dir, folderPath))) {
    if (!file.endsWith(suffix)) continue
    const sub = key.replace('*', file.slice(0, file.length - suffix.length)).slice(2)
    entries.set(`@smartdevutils/${dir}/${sub}`, `${dir}/${sub}`)
  }
}

function addPackage(dir: string, skip: readonly string[] = []): void {
  const exports = readPkg(dir).exports ?? {}
  for (const key of Object.keys(exports)) {
    if (key.endsWith('.json') || key.endsWith('.css') || skip.includes(key)) continue
    if (key.includes('*')) {
      addWildcard(dir, key, (exports[key] as { import?: string }).import ?? '')
    } else if (key === '.') {
      entries.set(`@smartdevutils/${dir}`, `${dir}/index`)
    } else {
      entries.set(`@smartdevutils/${dir}/${key.slice(2)}`, `${dir}/${key.slice(2)}`)
    }
  }
}

addPackage('core')
addPackage('browser')
addPackage('recipes')
addPackage('elements', ['./cdn'])
addPackage('react')

// React is CommonJS: wrap each specifier in an ES module with real named exports (virtual modules
// below), all importing the one bundled copy.
const reactSpecifiers = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'] as const
for (const s of reactSpecifiers) entries.set(s, `react/${s.replace('/', '-')}`)
// Mermaid is only reached through its own entry: browser/mermaid loads it lazily from
// globalThis.SDU_MERMAID_URL, which the sandbox points at this file.
entries.set('mermaid', 'mermaid/index')

const VIRTUAL = '\0sdu-react:'

function reactWrappers(): Plugin {
  return {
    name: 'sdu-react-wrappers',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer && (reactSpecifiers as readonly string[]).includes(id)) return VIRTUAL + id
      return null
    },
    load(id) {
      if (!id.startsWith(VIRTUAL)) return null
      const spec = id.slice(VIRTUAL.length)
      const names = Object.keys(require(spec) as object).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && n !== 'default')
      return [
        `import * as ns from ${JSON.stringify(spec)};`,
        `const m = ns.default ?? ns;`,
        `export default m;`,
        ...names.map((n) => `export const ${n} = m[${JSON.stringify(n)}];`),
      ].join('\n')
    },
  }
}

// mermaid is a dev/peer dependency of elements and react, not of this app: take elements' copy.
const mermaidEntry = join(packagesDir, 'elements/node_modules/mermaid/dist/mermaid.core.mjs')

function emitImportMapAndTheme(): Plugin {
  return {
    name: 'sdu-importmap',
    generateBundle(_opts, bundle) {
      const byName = new Map<string, string>()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) byName.set(chunk.name, chunk.fileName)
      }
      const imports: Record<string, string> = {}
      for (const [spec, name] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
        const file = byName.get(name)
        if (!file) this.error(`No output for ${spec}`)
        imports[spec] = `./${file}`
      }
      this.emitFile({ type: 'asset', fileName: 'importmap.json', source: JSON.stringify({ imports }, null, 2) + '\n' })
    },
    writeBundle() {
      const themeDist = join(packagesDir, 'theme/dist')
      mkdirSync(join(outDir, 'theme'), { recursive: true })
      for (const f of readdirSync(themeDist)) if (f.endsWith('.css')) copyFileSync(join(themeDist, f), join(outDir, 'theme', f))
    },
  }
}

/** Builds runtime/sandbox.ts as one classic script (it must run before any module, to install the import map). */
function sandboxScript(): Plugin {
  return {
    name: 'sdu-sandbox-script',
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: 'warn',
        publicDir: false,
        root: here,
        build: {
          outDir: resolve(here, 'public'),
          emptyOutDir: false,
          target: 'es2022',
          minify: true,
          lib: { entry: resolve(here, 'runtime/sandbox.ts'), formats: ['iife'], name: 'SduSandbox', fileName: () => 'sandbox.js' },
        },
      })
    },
  }
}

export default defineConfig({
  root: here,
  publicDir: false,
  logLevel: 'info',
  plugins: [reactWrappers(), emitImportMapAndTheme(), sandboxScript()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: /^mermaid$/, replacement: mermaidEntry }],
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    modulePreload: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      input: Object.fromEntries([...entries].map(([spec, name]) => [name, spec])),
      preserveEntrySignatures: 'strict',
      output: {
        format: 'es',
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
