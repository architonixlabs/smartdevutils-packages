import { Component, PLATFORM_ID, signal } from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { setMermaidLoader } from '@smartdevutils/browser/mermaid'
import { getRecipe, runFileText, runRecipe, type RecipeRun } from '@smartdevutils/recipes'
import { SduDiagramComponent } from './diagram.component'
import { SduBase64Component, SduJsonFormatterComponent } from './named-tools'
import { SduRecipeComponent } from './recipe.component'
import { SduRecipeRunComponent } from './recipe-run.component'
import { SduToolComponent, type SduToolResult } from './tool.component'
import { provideSmartDevUtils } from './config'

const settle = async (f: ComponentFixture<unknown>) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0))
    f.detectChanges()
    await f.whenStable()
  }
}
const q = <T extends Element = HTMLElement>(f: ComponentFixture<unknown>, sel: string) =>
  (f.nativeElement as HTMLElement).querySelector<T & Element>(sel) as T | null
const qa = (f: ComponentFixture<unknown>, sel: string) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(sel)]

afterEach(() => setMermaidLoader(null))

describe('SduToolComponent', () => {
  @Component({
    standalone: true,
    imports: [SduToolComponent],
    template: `<sdu-tool [tool]="tool" [(mode)]="mode" [(value)]="value" [options]="options()" [manual]="manual" (result)="results.push($event)" />`,
  })
  class Host {
    tool = 'base64-encoder-decoder'
    mode = 'decode'
    value = 'aGVsbG8='
    manual = false
    options = signal<Record<string, unknown>>({})
    results: SduToolResult[] = []
  }

  async function make(patch: Partial<Host> = {}) {
    TestBed.configureTestingModule({ imports: [Host] })
    const f = TestBed.createComponent(Host)
    Object.assign(f.componentInstance, patch)
    f.detectChanges()
    await new Promise((r) => setTimeout(r, 260))
    await settle(f)
    return f
  }

  it('runs as you type and emits result', async () => {
    const f = await make()
    expect(f.componentInstance.results.at(-1)).toMatchObject({ tool: 'base64-encoder-decoder', mode: 'decode', output: 'hello' })
    expect(q(f, '[data-role="output"]')?.textContent).toBe('hello')
  })

  it('renders ARIA tabs and switches mode with the arrow keys (two-way mode)', async () => {
    const f = await make({ manual: true })
    const tabs = qa(f, '[role="tab"]')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Encode', 'Decode'])
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    q(f, '[role="tablist"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await settle(f)
    expect(f.componentInstance.mode).toBe('encode')
    expect(q(f, 'label[for$="-input"]')?.textContent).toBe('Text')
  })

  it('builds settings from the spec and applies them', async () => {
    const f = await make({ tool: 'hash-generator', mode: 'sha256', value: 'abc', manual: true })
    expect(q(f, `[id$="-opt-secretKey"]`)).toBeNull()
    const box = q<HTMLInputElement>(f, `[id$="-opt-uppercase"]`)!
    box.checked = true
    box.dispatchEvent(new Event('change'))
    q<HTMLButtonElement>(f, '.sdu-btn-primary')!.click()
    await settle(f)
    expect(f.componentInstance.results.at(-1)?.output).toMatch(/^BA7816BF/)
  })

  it('shows an error with role=alert', async () => {
    const f = await make({ tool: 'json-formatter', mode: 'format', value: '{x' })
    expect(q(f, '[role="alert"]')?.textContent).toMatch(/Invalid JSON/)
  })

  it('explains a tool without a runner', async () => {
    const f = await make({ tool: 'nope' })
    expect(q(f, '[role="alert"]')?.textContent).toMatch(/has no runner/)
  })
})

describe('named tool components', () => {
  it('SduJsonFormatterComponent and SduBase64Component run their tool', async () => {
    @Component({
      standalone: true,
      imports: [SduJsonFormatterComponent, SduBase64Component],
      template: `<sdu-json-formatter value='{"a":1}' theme="dark" /><sdu-base64 mode="encode" value="hi" />`,
    })
    class Host {}
    TestBed.configureTestingModule({ imports: [Host] })
    const f = TestBed.createComponent(Host)
    f.detectChanges()
    await new Promise((r) => setTimeout(r, 260))
    await settle(f)
    const outs = qa(f, '[data-role="output"]').map((o) => o.textContent)
    expect(outs).toEqual(['{\n  "a": 1\n}', 'aGk='])
    expect(q(f, 'sdu-tool')?.getAttribute('data-theme')).toBe('dark')
  })
})

describe('SduDiagramComponent', () => {
  it('draws in the browser with strict Mermaid from the configured loader', async () => {
    const initialize = vi.fn()
    @Component({ standalone: true, imports: [SduDiagramComponent], template: `<sdu-diagram source="graph TD; A-->B" label="Flow" (rendered)="events.push($event)" />` })
    class Host {
      events: unknown[] = []
    }
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideSmartDevUtils({ mermaid: async () => ({ initialize, render: async () => ({ svg: '<svg viewBox="0 0 4 4"><text>x</text></svg>' }) }) })],
    })
    const f = TestBed.createComponent(Host)
    f.detectChanges()
    await settle(f)
    expect(f.componentInstance.events).toEqual([{ ok: true }])
    expect(q(f, '[role="img"] svg')).toBeTruthy()
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
  })

  it('does not draw on the server platform', async () => {
    const loader = vi.fn()
    setMermaidLoader(loader)
    TestBed.configureTestingModule({ imports: [SduDiagramComponent], providers: [{ provide: PLATFORM_ID, useValue: 'server' }] })
    const f = TestBed.createComponent(SduDiagramComponent)
    f.componentRef.setInput('source', 'graph TD; A')
    f.detectChanges()
    await settle(f)
    expect(loader).not.toHaveBeenCalled()
    expect(q(f, 'pre')?.textContent).toBe('graph TD; A')
  })
})

describe('SduRecipeComponent', () => {
  async function make(recipe = 'decode-base64-json-param') {
    TestBed.configureTestingModule({ imports: [SduRecipeComponent] })
    const f = TestBed.createComponent(SduRecipeComponent)
    f.componentRef.setInput('recipe', recipe)
    f.detectChanges()
    await settle(f)
    return f
  }

  it('runs all steps and shows what changed', async () => {
    const f = await make()
    const runs: RecipeRun[] = []
    f.componentInstance.run.subscribe((r) => runs.push(r))
    q<HTMLButtonElement>(f, '.sdu-btn-primary')!.click()
    await vi.waitFor(() => expect(runs).toHaveLength(1))
    await settle(f)
    expect(qa(f, '.sdu-step').map((s) => s.getAttribute('data-state'))).toEqual(['done', 'done', 'done'])
    expect(qa(f, '[data-role="headline"]')).toHaveLength(3)
    expect(q(f, '[data-role="finished"]')).toBeTruthy()
  })

  it('edits a step and runs from it', async () => {
    const f = await make()
    await f.componentInstance.runAll()
    await settle(f)
    qa(f, '.sdu-step-head button')[2]!.click()
    await settle(f)
    const ta = q<HTMLTextAreaElement>(f, '[id$="-edit-input"]')!
    ta.value = '{"z":0}'
    ta.dispatchEvent(new Event('input'))
    q<HTMLFormElement>(f, 'form')!.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => expect(f.componentInstance.current()?.trace[2]?.output).toBe('{\n  "z": 0\n}'))
  })

  it('loads a run file and reports a bad one', async () => {
    const f = await make()
    const file = runFileText(await runRecipe(getRecipe('json-to-base64-env')!))
    expect(f.componentInstance.loadRunFile(file)).toBe('')
    await settle(f)
    expect(q(f, 'h2')?.textContent).toMatch(/Base64/)
    expect(f.componentInstance.loadRunFile('nope')).not.toBe('')
  })

  it('says when a recipe cannot run yet', async () => {
    const f = await make('markdown-docs-a11y')
    expect(q(f, '[role="alert"]')?.textContent).toMatch(/cannot run in the page yet/)
  })
})

describe('SduRecipeRunComponent', () => {
  it('shows a run from file text', async () => {
    TestBed.configureTestingModule({ imports: [SduRecipeRunComponent] })
    const f = TestBed.createComponent(SduRecipeRunComponent)
    f.componentRef.setInput('fileText', runFileText(await runRecipe(getRecipe('decode-base64-json-param')!)))
    f.componentRef.setInput('upload', true)
    f.detectChanges()
    await settle(f)
    expect(qa(f, '.sdu-step')).toHaveLength(3)
    expect(q(f, 'input[type="file"]')).toBeTruthy()
  })
})
