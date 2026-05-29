import { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import { ErrorDisplay, ToolPanel } from '../shared'

export function QrCodeGenerator() {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!input || !canvasRef.current) return
    setError('')
    QRCode.toCanvas(canvasRef.current, input, { width: 256 }).catch(() => {
      setError('Failed to generate QR code')
    })
  }, [input])

  return (
    <ToolPanel title="QR Code Generator">
      <div className="space-y-4">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter URL or text..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        <canvas ref={canvasRef} className={input ? 'rounded-lg' : 'hidden'} />
      </div>
    </ToolPanel>
  )
}
