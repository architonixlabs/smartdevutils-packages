import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setMermaidLoader } from '@smartdevutils/browser/mermaid'
import {
  NAMED_TOOL_ELEMENTS,
  SduDiagramElement,
  SduRecipeElement,
  SduRecipeRunElement,
  SduToolElement,
  defineElement,
} from '../src/index'

const tick = () => new Promise((r) => setTimeout(r, 0))

async function mount<T extends HTMLElement>(markup: string): Promise<T> {
  const host = document.createElement('div')
  host.innerHTML = markup
  document.body.appendChild(host)
  const el = host.firstElementChild as T & { updateComplete?: Promise<unknown> }
  await el.updateComplete
  return el
}

const shadow = (el: Element) => el.shadowRoot!
const text = (el: Element, sel: string) => shadow(el).querySelector(sel)?.textContent?.trim() ?? ''

afterEach(() => {
  document.body.innerHTML = ''
  setMermaidLoader(null)
})

describe('registration', () => {
  it('registers every element once and tolerates a second define', () => {
    for (const tag of ['sdu-tool', 'sdu-diagram', 'sdu-recipe', 'sdu-recipe-run', ...Object.keys(NAMED_TOOL_ELEMENTS)]) {
      expect(customElements.get(tag), tag).toBeTruthy()
    }
    expect(() => defineElement('sdu-tool', class extends SduToolElement {})).not.toThrow()
    expect(customElements.get('sdu-tool')).toBe(SduToolElement)
  })
})

describe('<sdu-tool>', () => {
  it('runs a tool from attributes and fires sdu-output', async () => {
    const outputs: unknown[] = []
    document.addEventListener('sdu-output', (e) => outputs.push((e as CustomEvent).detail), { once: true })
    const el = await mount<SduToolElement>('<sdu-tool tool="base64-encoder-decoder" mode="decode" manual value="aGVsbG8="></sdu-tool>')
    await el.ready
    const res = await el.run()
    await el.updateComplete
    expect(res.output).toBe('hello')
    expect(text(el, '[part="output"]')).toBe('hello')
    expect(outputs[0]).toMatchObject({ tool: 'base64-encoder-decoder', mode: 'decode', output: 'hello' })
  })

  it('renders mode tabs with ARIA roles and moves between them with the arrow keys', async () => {
    const el = await mount<SduToolElement>('<sdu-tool tool="url-encoder-decoder" manual></sdu-tool>')
    await el.ready
    await el.updateComplete
    const tabs = [...shadow(el).querySelectorAll('[role="tab"]')]
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Encode', 'Decode'])
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(shadow(el).querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe('tab-encode')
    shadow(el).querySelector('[role="tablist"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await el.updateComplete
    expect(el.mode).toBe('decode')
    expect(shadow(el).querySelector('label[for="input"]')?.textContent).toBe('Encoded URL')
  })

  it('builds the settings form from the spec, filtered by mode, and uses the values', async () => {
    const el = await mount<SduToolElement>('<sdu-tool tool="hash-generator" mode="sha256" manual value="abc"></sdu-tool>')
    await el.ready
    await el.updateComplete
    expect(shadow(el).querySelector('#opt-secretKey')).toBeNull()
    const upper = shadow(el).querySelector<HTMLInputElement>('#opt-uppercase')!
    upper.checked = true
    upper.dispatchEvent(new Event('change'))
    const res = await el.run()
    expect(res.output).toBe('BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD')
    el.mode = 'hmac-sha256'
    await el.updateComplete
    expect(shadow(el).querySelector('label[for="opt-secretKey"]')?.textContent).toBe('Secret key')
  })

  it('takes options as a property and runs as you type unless manual', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const el = await mount<SduToolElement>('<sdu-tool tool="base64-encoder-decoder"></sdu-tool>')
      await el.ready
      el.options = { variant: 'urlsafe-nopad' }
      const ta = shadow(el).querySelector<HTMLTextAreaElement>('textarea')!
      ta.value = '??>'
      ta.dispatchEvent(new Event('input'))
      await el.updateComplete
      const got = new Promise<CustomEvent>((r) => el.addEventListener('sdu-output', (e) => r(e as CustomEvent), { once: true }))
      vi.advanceTimersByTime(250)
      const ev = await got
      expect(ev.detail.output).toBe('Pz8-')
      expect(el.input).toBe('??>')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows an error with role=alert and fires sdu-error', async () => {
    const el = await mount<SduToolElement>('<sdu-tool tool="json-formatter" manual value="{bad"></sdu-tool>')
    await el.ready
    const err = new Promise<CustomEvent>((r) => el.addEventListener('sdu-error', (e) => r(e as CustomEvent), { once: true }))
    await el.run()
    await el.updateComplete
    expect((await err).detail.error).toMatch(/Invalid JSON/)
    expect(shadow(el).querySelector('[role="alert"]')?.textContent).toMatch(/Invalid JSON/)
  })

  it('explains a tool that has no runner', async () => {
    const el = await mount<SduToolElement>('<sdu-tool tool="not-a-tool"></sdu-tool>')
    await el.ready
    await el.updateComplete
    expect(text(el, '[role="alert"]')).toMatch(/has no runner/)
  })

  it('named elements are fixed to their tool', async () => {
    const el = await mount<SduToolElement>('<sdu-json-formatter manual value=\'{"a":1}\'></sdu-json-formatter>')
    await el.ready
    expect(el.tool).toBe('json-formatter')
    expect((await el.run()).output).toBe('{\n  "a": 1\n}')
  })

  it('sets data-theme from the theme attribute and copies the output', async () => {
    const el = await mount<SduToolElement>('<sdu-uuid-generator theme="dark" manual></sdu-uuid-generator>')
    await el.ready
    await el.updateComplete
    expect(el.getAttribute('data-theme')).toBe('dark')
    el.theme = 'auto'
    await el.updateComplete
    expect(el.hasAttribute('data-theme')).toBe(false)
    const res = await el.setInput('', { options: { count: 3 } })
    expect(res.output.split('\n')).toHaveLength(3)
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await el.updateComplete
    shadow(el).querySelector<HTMLButtonElement>('[part~="copy"]')!.click()
    await tick()
    expect(writeText).toHaveBeenCalledWith(res.output)
  })
})

describe('theme', () => {
  it('follows the nearest ancestor data-theme, and the theme attribute wins', async () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-theme', 'dark')
    document.body.appendChild(wrap)
    wrap.innerHTML = '<sdu-tool tool="json-formatter" manual></sdu-tool>'
    const el = wrap.firstElementChild as SduToolElement
    await el.updateComplete
    expect(el.getAttribute('data-sdu-scheme')).toBe('dark')
    wrap.setAttribute('data-theme', 'light')
    await vi.waitFor(() => expect(el.getAttribute('data-sdu-scheme')).toBe('light'))
    el.theme = 'dark'
    await el.updateComplete
    expect(el.getAttribute('data-sdu-scheme')).toBe('dark')
    wrap.removeAttribute('data-theme')
    el.theme = 'auto'
    await el.updateComplete
    await vi.waitFor(() => expect(el.hasAttribute('data-sdu-scheme')).toBe(false))
  })
})

describe('<sdu-diagram>', () => {
  beforeEach(() => {
    setMermaidLoader(async () => ({
      initialize: vi.fn(),
      render: async (id: string, src: string) => {
        if (src.includes('bad')) throw new Error('Parse error on line 1')
        return { svg: `<svg id="${id}" viewBox="0 0 100 50"><text>${src.length}</text></svg>` }
      },
    }))
  })

  it('draws the source as SVG and fires sdu-rendered', async () => {
    const el = await mount<SduDiagramElement>('<sdu-diagram label="Flow" source="graph TD; A-->B"></sdu-diagram>')
    const detail = await el.rendered
    await el.updateComplete
    expect(detail).toEqual({ ok: true })
    expect(shadow(el).querySelector('[part="diagram"] svg')).toBeTruthy()
    expect(shadow(el).querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Flow')
    expect(el.toSvg()).toContain('<svg')
  })

  it('reads the text content when there is no source attribute, and shows parse errors', async () => {
    const el = await mount<SduDiagramElement>('<sdu-diagram>graph bad</sdu-diagram>')
    const detail = await el.rendered
    await el.updateComplete
    expect(detail.ok).toBe(false)
    expect(text(el, '[role="alert"]')).toBe('Parse error on line 1')
    expect(shadow(el).querySelector<HTMLButtonElement>('button')!.disabled).toBe(true)
  })
})

describe('<sdu-recipe>', () => {
  it('runs every step of a built-in recipe on its sample and shows what changed', async () => {
    const el = await mount<SduRecipeElement>('<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>')
    await el.ready
    const steps: number[] = []
    el.addEventListener('sdu-step', (e) => steps.push((e as CustomEvent).detail.index))
    const run = (await el.runAll())!
    await el.updateComplete
    expect(steps).toEqual([0, 1, 2])
    expect(run.stopped).toBeUndefined()
    const items = [...shadow(el).querySelectorAll('.sdu-step')]
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'done', 'done'])
    expect(items[2]!.querySelector('[data-role="headline"]')?.textContent).toMatch(/JSON/)
    expect(shadow(el).querySelector('[data-role="finished"]')).toBeTruthy()
  })

  it('edits a step and runs again from it', async () => {
    const el = await mount<SduRecipeElement>('<sdu-recipe recipe-id="decode-base64-json-param"></sdu-recipe>')
    await el.ready
    await el.runAll()
    const again = (await el.runFrom(2, { input: '{"edited":true}' }))!
    await el.updateComplete
    expect(again.trace[2]?.output).toBe('{\n  "edited": true\n}')
    expect(again.trace[0]).toEqual(el.run!.trace[0])
  })

  it('opens the step editor from the Edit button with the step input filled in', async () => {
    const el = await mount<SduRecipeElement>('<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>')
    await el.ready
    await el.runAll()
    await el.updateComplete
    const edit = [...shadow(el).querySelectorAll<HTMLButtonElement>('.sdu-step-head button')][1]!
    edit.click()
    await vi.waitFor(() => expect(shadow(el).querySelector('form[part="editor"]')).toBeTruthy())
    expect(edit.getAttribute('aria-expanded')).toBe('true')
    const ta = shadow(el).querySelector<HTMLTextAreaElement>('#edit-1-input')!
    expect(ta.value).toBe(el.run!.trace[1]!.input)
    expect(shadow(el).querySelector('#edit-1-mode')).toBeTruthy()
  })

  it('round-trips a run file and rejects a bad one', async () => {
    const el = await mount<SduRecipeElement>('<sdu-recipe recipe="json-to-base64-env"></sdu-recipe>')
    await el.ready
    await el.runAll()
    const file = el.runFileText()!
    expect(JSON.parse(file).schema).toBe('sdu-recipe-run/1')

    const other = await mount<SduRecipeElement>('<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>')
    await other.ready
    expect(await other.loadRunFile(file)).toBe('')
    expect(other.run?.basedOn).toBe('json-to-base64-env')
    expect(await other.loadRunFile('{"schema":"nope"}')).not.toBe('')
  })

  it('says which tools cannot run yet', async () => {
    const el = await mount<SduRecipeElement>('<sdu-recipe recipe="markdown-docs-a11y"></sdu-recipe>')
    await el.ready
    await el.updateComplete
    expect(text(el, '[role="alert"]')).toMatch(/cannot run in the page yet/)
    expect(shadow(el).querySelector<HTMLButtonElement>('[part~="run"]')!.disabled).toBe(true)
  })
})

describe('<sdu-recipe-run>', () => {
  it('shows a run from file text', async () => {
    const maker = await mount<SduRecipeElement>('<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>')
    await maker.ready
    await maker.runAll()
    const el = await mount<SduRecipeRunElement>('<sdu-recipe-run upload></sdu-recipe-run>')
    const shown = new Promise((r) => el.addEventListener('sdu-run', r, { once: true }))
    el.fileText = maker.runFileText()!
    await shown
    await el.updateComplete
    expect(shadow(el).querySelectorAll('.sdu-step')).toHaveLength(3)
    expect(shadow(el).querySelector('input[type="file"]')).toBeTruthy()
    expect(el.shown?.name).toBe(maker.run?.name)
  })
})
