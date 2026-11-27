// Builds an "Open in StackBlitz" project (POST https://stackblitz.com/run). The only third-party call
// in the playground, made only when the visitor clicks the button.
import type { ApiItem, PackageDoc, SnippetLang } from '../core/model'
import { bareImports, packageOf } from './snippet-files'

export const STACKBLITZ_URL = 'https://stackblitz.com/run'

export interface StackBlitzProject {
  title: string
  description: string
  template: 'node' | 'javascript'
  files: Record<string, string>
  dependencies: Record<string, string>
  /** File StackBlitz opens first. */
  openFile: string
}

export interface StackBlitzInput {
  pkg: PackageDoc
  item: ApiItem
  lang: SnippetLang
  code: string
  /** Shared @smartdevutils/* version, from docs.json. */
  version: string
  /** True for Angular docs snippets (angular package, or a ts snippet that uses @angular/core). */
  angular?: boolean
}

const KNOWN_VERSIONS: Record<string, string> = {
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  mermaid: '^11.4.0',
  '@angular/core': '^22.0.0',
  '@angular/common': '^22.0.0',
  '@angular/compiler': '^22.0.0',
  '@angular/platform-browser': '^22.0.0',
  '@angular/router': '^22.0.0',
  '@angular/forms': '^22.0.0',
  rxjs: '~7.8.0',
  tslib: '^2.6.0',
}

/** Dependencies for the imports in `code`; @smartdevutils/* are pinned to the exact docs version. */
export function dependenciesFor(code: string, version: string, extra: string[] = []): Record<string, string> {
  const deps: Record<string, string> = {}
  for (const name of [...bareImports(code).map(packageOf), ...extra]) {
    if (deps[name]) continue
    if (name.startsWith('@smartdevutils/')) deps[name] = version
    else deps[name] = KNOWN_VERSIONS[name] ?? 'latest'
  }
  return deps
}

export function isAngularSnippet(pkg: PackageDoc, code: string): boolean {
  return pkg.id === 'angular' || /from\s+['"]@angular\/core['"]/.test(code)
}

export function buildStackBlitzProject(input: StackBlitzInput): StackBlitzProject {
  const { pkg, item, lang, code, version } = input
  const title = `${item.name} — ${pkg.name}`
  const description = `${item.summary} Example from the SmartDevUtils Playground (${pkg.name}@${version}).`
  const angular = input.angular ?? (lang === 'ts' && isAngularSnippet(pkg, code))
  const base = { title, description }
  if (angular) return { ...base, ...angularProject(code, version, item.name) }
  switch (lang) {
    case 'ts':
    case 'js':
      return { ...base, ...nodeProject(code, lang, version, title) }
    case 'tsx':
      return { ...base, ...reactProject(code, version, title) }
    case 'html':
      return { ...base, ...htmlProject(code, version, title, pkg) }
  }
}

function pkgJson(o: Record<string, unknown>): string {
  return JSON.stringify(o, null, 2) + '\n'
}

function nodeProject(code: string, lang: 'ts' | 'js', version: string, title: string) {
  const deps = dependenciesFor(code, version)
  const file = lang === 'ts' ? 'index.ts' : 'index.js'
  const files: Record<string, string> = {
    [file]: code,
    'package.json': pkgJson({
      name: 'smartdevutils-example',
      private: true,
      description: title,
      type: 'module',
      scripts: { start: lang === 'ts' ? 'tsx index.ts' : 'node index.js' },
      dependencies: deps,
      ...(lang === 'ts' ? { devDependencies: { tsx: '^4.19.0', typescript: '^5.6.0' } } : {}),
    }),
  }
  return { template: 'node' as const, files, dependencies: deps, openFile: file }
}

function reactProject(code: string, version: string, title: string) {
  const deps = dependenciesFor(code, version, ['react', 'react-dom'])
  const mountsItself = /\bcreateRoot\s*\(|\bReactDOM\.render\s*\(/.test(code)
  const files: Record<string, string> = {
    'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(title)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n`,
    'tsconfig.json': pkgJson({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
      },
      include: ['src'],
    }),
    'package.json': pkgJson({
      name: 'smartdevutils-react-example',
      private: true,
      type: 'module',
      scripts: { dev: 'vite', start: 'vite' },
      dependencies: deps,
      devDependencies: {
        vite: '^6.0.0',
        '@vitejs/plugin-react': '^4.3.0',
        typescript: '^5.6.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
      },
    }),
  }
  if (mountsItself) {
    files['src/main.tsx'] = code
  } else {
    files['src/App.tsx'] = code
    const named = /export\s+default\s/.test(code) ? null : /export\s+function\s+([A-Z]\w*)/.exec(code)?.[1]
    const importLine = named ? `import { ${named} as App } from './App'` : `import App from './App'`
    files['src/main.tsx'] =
      `import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\n${importLine}\n\n` +
      `createRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n)\n`
  }
  return {
    template: 'node' as const,
    files,
    dependencies: deps,
    openFile: mountsItself ? 'src/main.tsx' : 'src/App.tsx',
  }
}

const MODULE_SCRIPT_RE = /<script\b[^>]*\btype=["']module["'][^>]*>([\s\S]*?)<\/script>/gi

function htmlProject(code: string, version: string, title: string, pkg: PackageDoc) {
  // Inline module scripts move to index.js so StackBlitz can resolve their bare imports.
  const scripts: string[] = []
  const markup = code
    .replace(MODULE_SCRIPT_RE, (whole, body: string) => {
      if (/\bsrc=/.test(whole.slice(0, whole.indexOf('>')))) return whole
      scripts.push(dedent(body))
      return ''
    })
    .trim()
  const js = scripts.join('\n\n')
  const usesElements = /<sdu-[a-z]/.test(code) || pkg.id === 'elements'
  const jsImports = bareImports(js)
  const deps = dependenciesFor(js, version)
  const lines: string[] = []
  if (usesElements && !jsImports.some((s) => s.startsWith('@smartdevutils/elements'))) {
    lines.push(`import '@smartdevutils/elements'`)
    deps['@smartdevutils/elements'] = version
  }
  if (!jsImports.some((s) => s.startsWith('@smartdevutils/theme'))) {
    deps['@smartdevutils/theme'] = version
  }
  const indexJs = [`import '@smartdevutils/theme/styles.css'`, ...lines, js].filter(Boolean).join('\n') + '\n'
  const files: Record<string, string> = {
    'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(title)}</title>\n  </head>\n  <body>\n${indent(markup, 4)}\n  </body>\n</html>\n`,
    'index.js': indexJs,
  }
  return { template: 'javascript' as const, files, dependencies: deps, openFile: 'index.html' }
}

function angularProject(code: string, version: string, itemName: string) {
  const ownBootstrap = /\bbootstrapApplication\s*\(/.test(code)
  const component = /export\s+class\s+(\w+)/.exec(code)?.[1] ?? 'AppComponent'
  const selector = /selector:\s*['"]([\w-]+)['"]/.exec(code)?.[1] ?? 'app-root'
  const ng = '^22.0.0'
  const deps = {
    ...dependenciesFor(code, version, [
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      'rxjs',
      'tslib',
    ]),
  }
  const files: Record<string, string> = {
    'src/index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>${escapeHtml(itemName)}</title>\n    <base href="/" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n  </head>\n  <body>\n    <${selector}></${selector}>\n  </body>\n</html>\n`,
    'src/styles.css': `@import '@smartdevutils/theme/styles.css';\n`,
    'angular.json': pkgJson({
      $schema: './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      cli: { analytics: false },
      projects: {
        demo: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                index: 'src/index.html',
                tsConfig: 'tsconfig.json',
                styles: ['src/styles.css'],
                outputPath: 'dist',
              },
              configurations: { development: { optimization: false, sourceMap: true } },
              defaultConfiguration: 'development',
            },
            serve: {
              builder: '@angular/build:dev-server',
              options: { buildTarget: 'demo:build:development' },
            },
          },
        },
      },
    }),
    'tsconfig.json': pkgJson({
      compilerOptions: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        experimentalDecorators: true,
        lib: ['ES2022', 'dom'],
      },
      files: ['src/main.ts'],
    }),
    'package.json': pkgJson({
      name: 'smartdevutils-angular-example',
      private: true,
      scripts: { start: 'ng serve', build: 'ng build' },
      dependencies: { ...deps, '@smartdevutils/theme': version },
      devDependencies: { '@angular/build': ng, '@angular/cli': ng, '@angular/compiler-cli': ng, typescript: '~6.0.2' },
    }),
  }
  if (ownBootstrap) {
    files['src/main.ts'] = code
  } else {
    files['src/app.ts'] = code
    files['src/main.ts'] =
      `import { provideZonelessChangeDetection } from '@angular/core'\nimport { bootstrapApplication } from '@angular/platform-browser'\nimport { ${component} } from './app'\n\n` +
      `bootstrapApplication(${component}, { providers: [provideZonelessChangeDetection()] }).catch((err) => console.error(err))\n`
  }
  return {
    template: 'node' as const,
    files,
    dependencies: deps,
    openFile: ownBootstrap ? 'src/main.ts' : 'src/app.ts',
  }
}

/** Form fields for the StackBlitz POST API, in submission order. */
export function stackBlitzFormFields(p: StackBlitzProject): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ['project[title]', p.title],
    ['project[description]', p.description],
    ['project[template]', p.template],
  ]
  for (const [path, content] of Object.entries(p.files)) fields.push([`project[files][${path}]`, content])
  fields.push(['project[dependencies]', JSON.stringify(p.dependencies)])
  return fields
}

export function stackBlitzAction(p: StackBlitzProject): string {
  return `${STACKBLITZ_URL}?file=${encodeURIComponent(p.openFile)}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

function dedent(s: string): string {
  const lines = s.replace(/^\n+|\s+$/g, '').split('\n')
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length))
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join('\n')
}

function indent(s: string, n: number): string {
  const pad = ' '.repeat(n)
  return s
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n')
}
