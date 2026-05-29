import { useState } from 'react'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

export function ColorConverter() {
  const [hex, setHex] = useState('')
  const [error, setError] = useState('')

  const rgb = hexToRgb(hex)
  const hsl = rgb ? rgbToHsl(...rgb) : null

  const handleChange = (v: string) => {
    setHex(v)
    setError(!v || hexToRgb(v) ? '' : 'Invalid hex color')
  }

  return (
    <ToolPanel title="Color Converter">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input type="color" value={hex || '#000000'} onChange={e => handleChange(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-gray-300" />
          <input value={hex} onChange={e => handleChange(e.target.value)} placeholder="#ffffff"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        {error && <ErrorDisplay message={error} />}
        {rgb && (
          <div className="space-y-2">
            {[
              { label: 'HEX', value: hex },
              { label: 'RGB', value: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` },
              { label: 'HSL', value: `hsl(${hsl![0]}, ${hsl![1]}%, ${hsl![2]}%)` },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="w-10 text-xs font-medium text-gray-500">{f.label}</span>
                <code className="flex-1 font-mono text-sm dark:text-green-400">{f.value}</code>
                <CopyButton text={f.value} />
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
