import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { DocsService } from '../core/docs.service'
import { CodeBlock } from '../shared/code-block'
import { CopyButton } from '../shared/copy-button'

@Component({
  selector: 'pg-home',
  imports: [RouterLink, CodeBlock, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <h1>SmartDevUtils Playground</h1>
        <p class="lead">
          Docs and a live editor for every <code>&#64;smartdevutils</code> package. Pick a function, tool, element
          or component, read what it does, change the example and run it in your browser, then copy the install
          line and imports into your project.
        </p>
        <p class="muted small">
          Code runs in a sandboxed frame with no access to this site. Edits are saved in this browser only;
          Share puts the code in the link itself.
        </p>
      </header>

      <section aria-labelledby="pkgs-title">
        <h2 id="pkgs-title">Packages <span class="muted small">v{{ docs.version() }}</span></h2>
        <ul class="card-grid">
          @for (pkg of docs.packages(); track pkg.id) {
            <li class="card">
              <h3 class="card-title"><a [routerLink]="['/', pkg.id]">{{ pkg.name }}</a></h3>
              <p class="card-text">{{ pkg.description }}</p>
              <div class="install-line">
                <code>{{ pkg.install }}</code>
                <pg-copy-button [value]="pkg.install" [label]="'Copy install command for ' + pkg.name" />
              </div>
              <p class="card-meta muted small">
                {{ itemCount(pkg.id) }} entries · {{ pkg.frameworks.join(', ') }}
              </p>
            </li>
          }
        </ul>
      </section>

      <section aria-labelledby="qs-title">
        <h2 id="qs-title">Quick start</h2>
        <p>Install a package, import one module, call it. Every module is its own entry point.</p>
        <pg-code-block label="Terminal" code="npm install @smartdevutils/core" />
        <pg-code-block label="index.ts" [code]="quickStart" />
        <p>
          Then try it here: <a [routerLink]="quickStartLink()">sha256 in the playground</a>, or press
          <kbd>/</kbd> to search.
        </p>
      </section>
    </div>
  `,
})
export class HomePage {
  protected readonly docs = inject(DocsService)

  protected readonly quickStart = [
    "import { sha256 } from '@smartdevutils/core/hashing'",
    "import { base64Encode } from '@smartdevutils/core/encoding'",
    "import { runTool } from '@smartdevutils/core/tools'",
    '',
    "console.log(sha256('hello world'))",
    'console.log(base64Encode(\'{"user":"ada"}\'))',
    '',
    "const res = await runTool('base64-encoder-decoder', 'aGVsbG8=', { mode: 'decode' })",
    'console.log(res.output) // hello',
  ].join('\n')

  private readonly counts = computed(() => {
    const m = new Map<string, number>()
    for (const p of this.docs.packages()) m.set(p.id, p.sections.reduce((n, s) => n + s.items.length, 0))
    return m
  })

  protected readonly quickStartLink = computed(() => {
    const core = this.docs.package('core')
    const sec = core?.sections.find((s) => s.items.some((i) => i.name === 'sha256'))
    const item = sec?.items.find((i) => i.name === 'sha256')
    return sec && item ? ['/', 'core', sec.id, item.id] : ['/', 'core']
  })

  constructor() {
    inject(Title).setTitle('SmartDevUtils Playground')
  }

  protected itemCount(id: string): number {
    return this.counts().get(id) ?? 0
  }
}
