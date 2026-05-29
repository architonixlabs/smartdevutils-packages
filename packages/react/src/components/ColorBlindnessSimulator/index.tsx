import { useRef, useState } from 'react'
import { simulateDeuteranopia, simulateProtanopia, simulateTritanopia } from '@smartdevutils/browser/color-blindness'
import { ToolPanel } from '../shared'

const MODES = [
  { key: 'protanopia', label: 'Protanopia (red-blind)', fn: simulateProtanopia },
  { key: 'deuteranopia', label: 'Deuteranopia (green-blind)', fn: simulateDeuteranopia },
  { key: 'tritanopia', label: 'Tritanopia (blue-blind)', fn: simulateTritanopia },
]

export function ColorBlindnessSimulator() {
  const [original, setOriginal] = useState<string | null>(null)
  const [simulated, setSimulated] = useState<Record<string, string>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setOriginal(url)
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const results: Record<string, string> = {}
      MODES.forEach(({ key, fn }) => {
        const simData = fn(imageData)
        ctx.putImageData(simData, 0, 0)
        results[key] = canvas.toDataURL()
        ctx.drawImage(img, 0, 0)
      })
      setSimulated(results)
    }
    img.src = url
  }

  return (
    <ToolPanel title="Color Blindness Simulator">
      <canvas ref={canvasRef} className="hidden" />
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-emerald-400 dark:border-gray-600">
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <p className="text-sm text-gray-500">Drop an image or click to upload</p>
        </label>
        {original && (
          <div className="grid grid-cols-2 gap-4">
            <div><p className="mb-1 text-xs font-medium text-gray-500">Original</p><img src={original} className="w-full rounded" alt="original" /></div>
            {MODES.map(({ key, label }) => simulated[key] && (
              <div key={key}><p className="mb-1 text-xs font-medium text-gray-500">{label}</p><img src={simulated[key]} className="w-full rounded" alt={label} /></div>
            ))}
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
