import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setMermaidLoader } from '@smartdevutils/browser/mermaid'
import { runFileText, runRecipe, getRecipe } from '@smartdevutils/recipes'
import { SduDiagram, SduRecipe, SduRecipeRun, SduTool } from './index'

afterEach(() => setMermaidLoader(null))

describe('SduTool', () => {
  it('runs a tool as you type and reports the result', async () => {
    const onResult = vi.fn()
    render(<SduTool tool="base64-encoder-decoder" defaultMode="decode" defaultValue="aGVsbG8=" onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ output: 'hello', mode: 'decode' })))
    expect(screen.getByRole('region', { name: 'Text' })).toHaveTextContent('hello')
  })

  it('has labelled mode tabs that follow the arrow keys', async () => {
    const onModeChange = vi.fn()
    render(<SduTool tool="url-encoder-decoder" manual onModeChange={onModeChange} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Encode', 'Decode'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onModeChange).toHaveBeenCalledWith('decode')
    expect(screen.getByLabelText('Encoded URL')).toBeInTheDocument()
  })

  it('builds settings from the spec and shows errors with role=alert', async () => {
    render(<SduTool tool="json-formatter" manual defaultValue="{oops" />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid JSON/)
  })

  it('applies options and form edits', async () => {
    const onResult = vi.fn()
    render(<SduTool tool="hash-generator" defaultMode="sha256" defaultValue="abc" options={{ uppercase: true }} onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalled())
    expect(onResult.mock.lastCall![0].output).toMatch(/^BA7816BF/)
    fireEvent.click(screen.getByLabelText('Uppercase hex'))
    await waitFor(() => expect(onResult.mock.lastCall![0].output).toMatch(/^ba7816bf/))
  })

  it('explains a tool without a runner', () => {
    render(<SduTool tool="nope" />)
    expect(screen.getByRole('alert')).toHaveTextContent('has no runner')
  })

  it('renders on the server without touching window', () => {
    const html = renderToString(<SduTool tool="uuid-generator" theme="dark" />)
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('UUID Generator')
  })
})

describe('SduDiagram', () => {
  it('draws with Mermaid in strict mode and reports the result', async () => {
    const initialize = vi.fn()
    setMermaidLoader(async () => ({ initialize, render: async () => ({ svg: '<svg viewBox="0 0 10 10"><text>A</text></svg>' }) }))
    const onRendered = vi.fn()
    const { container } = render(<SduDiagram source="graph TD; A-->B" label="Flow" onRendered={onRendered} />)
    await waitFor(() => expect(onRendered).toHaveBeenCalledWith({ ok: true }))
    expect(container.querySelector('[role="img"] svg')).toBeTruthy()
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }))
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeEnabled()
  })

  it('shows a parse error', async () => {
    setMermaidLoader(async () => ({ initialize() {}, render: async () => Promise.reject(new Error('Parse error')) }))
    render(<SduDiagram source="nope" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Parse error')
  })

  it('draws nothing during server rendering', () => {
    expect(renderToString(<SduDiagram source="graph TD; A" />)).not.toContain('<svg')
  })
})

describe('SduRecipe', () => {
  it('runs all steps and shows what changed', async () => {
    const onRun = vi.fn()
    const { container } = render(<SduRecipe recipe="decode-base64-json-param" onRun={onRun} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run all steps' }))
    await waitFor(() => expect(onRun).toHaveBeenCalled())
    const steps = container.querySelectorAll('.sdu-step')
    expect([...steps].map((s) => s.getAttribute('data-state'))).toEqual(['done', 'done', 'done'])
    expect(within(steps[2] as HTMLElement).getByText(/What changed/)).toBeInTheDocument()
    expect(screen.getByText('Every step ran.')).toBeInTheDocument()
  })

  it('edits a step and runs from it', async () => {
    const onRun = vi.fn()
    render(<SduRecipe recipe="decode-base64-json-param" onRun={onRun} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run all steps' }))
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit step 3' }))
    fireEvent.change(screen.getByLabelText('Input for step 3'), { target: { value: '{"x":1}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run from this step' }))
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(2))
    expect(onRun.mock.lastCall![0].trace[2].output).toBe('{\n  "x": 1\n}')
  })

  it('uploads a run file', async () => {
    const run = await runRecipe(getRecipe('json-to-base64-env')!)
    const onRun = vi.fn()
    const { container } = render(<SduRecipe recipe="decode-base64-json-param" onRun={onRun} />)
    const file = new File([runFileText(run)], 'run.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    })
    await waitFor(() => expect(onRun).toHaveBeenCalled())
    expect(onRun.mock.lastCall![0].basedOn).toBe('json-to-base64-env')
  })
})

describe('SduRecipeRun', () => {
  it('shows a run from file text and reports bad files', async () => {
    const run = await runRecipe(getRecipe('decode-base64-json-param')!)
    const { container, rerender } = render(<SduRecipeRun fileText={runFileText(run)} />)
    expect(container.querySelectorAll('.sdu-step')).toHaveLength(3)
    const onError = vi.fn()
    rerender(<SduRecipeRun fileText="{}" onError={onError} />)
    await waitFor(() => expect(onError).toHaveBeenCalled())
  })
})
