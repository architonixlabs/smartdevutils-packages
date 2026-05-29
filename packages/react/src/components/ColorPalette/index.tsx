import { useState } from 'react'
import { hexToHsl, hslToRgb, rgbToHex } from '@smartdevutils/core/color'
import { CopyButton, ToolPanel } from '../shared'

export function ColorPalette({ baseHex = '#3b82f6', swatches = 9, onResult }: { baseHex?: string; swatches?: number; onResult?: (p: string[]) => void }) {
  const [hex, setHex] = useState(baseHex)
  const palette = (() => {
    try {
      const { h, s } = hexToHsl(hex)
      return Array.from({ length: swatches }, (_, i) => {
        const l = Math.round(10 + (i * (80 / (swatches - 1))))
        const { r, g, b } = hslToRgb(h, s, l)
        return rgbToHex(r, g, b)
      })
    } catch { return [] }
  })()
  if (palette.length) onResult?.(palette)
  return (
    <ToolPanel title="Color Palette Generator">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input type="color" value={hex} onChange={e=>setHex(e.target.value)} className="h-10 w-16 cursor-pointer rounded border" />
          <input value={hex} onChange={e=>setHex(e.target.value)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        {palette.length > 0 && (
          <div className="flex gap-1">
            {palette.map((color, i) => (
              <div key={i} className="group relative flex-1 cursor-pointer" onClick={()=>navigator.clipboard?.writeText(color)}>
                <div className="h-16 rounded" style={{ backgroundColor: color }} title={color} />
                <div className="mt-1 text-center text-xs font-mono opacity-70">{color}</div>
              </div>
            ))}
          </div>
        )}
        {palette.length > 0 && <div className="flex justify-end"><CopyButton text={palette.join(', ')} /></div>}
      </div>
    </ToolPanel>
  )
}
