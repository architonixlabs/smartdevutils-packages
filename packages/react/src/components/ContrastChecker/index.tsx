import { useState } from 'react'
import { ErrorDisplay, ToolPanel } from '../shared'

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function ContrastChecker() {
  const [fg, setFg] = useState('#000000')
  const [bg, setBg] = useState('#ffffff')
  const [error] = useState('')

  const fgRgb = hexToRgb(fg)
  const bgRgb = hexToRgb(bg)
  const ratio = fgRgb && bgRgb ? contrastRatio(relativeLuminance(fgRgb), relativeLuminance(bgRgb)) : null

  return (
    <ToolPanel title="Contrast Checker" description="WCAG AA/AAA compliance checker">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[{ label: 'Foreground', value: fg, set: setFg }, { label: 'Background', value: bg, set: setBg }].map(c => (
            <div key={c.label} className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.label}</label>
              <div className="flex gap-2">
                <input type="color" value={c.value} onChange={e => c.set(e.target.value)} className="h-9 w-12 rounded border border-gray-300" />
                <input value={c.value} onChange={e => c.set(e.target.value)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
          ))}
        </div>
        {error && <ErrorDisplay message={error} />}
        {ratio !== null && (
          <div className="space-y-3">
            <div className="rounded-lg p-4 text-center" style={{ color: fg, backgroundColor: bg }}>
              <p className="text-lg font-semibold">Sample Text</p>
              <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-center text-2xl font-bold text-gray-900 dark:text-white">{ratio.toFixed(2)}:1</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
                <div className={`rounded p-2 ${ratio >= 4.5 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>AA Normal {ratio >= 4.5 ? '✓' : '✗'}</div>
                <div className={`rounded p-2 ${ratio >= 3 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>AA Large {ratio >= 3 ? '✓' : '✗'}</div>
                <div className={`rounded p-2 ${ratio >= 7 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>AAA Normal {ratio >= 7 ? '✓' : '✗'}</div>
                <div className={`rounded p-2 ${ratio >= 4.5 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>AAA Large {ratio >= 4.5 ? '✓' : '✗'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
