import QRCode from 'qrcode'

export type QrOptions = { width?: number; margin?: number; color?: { dark?: string; light?: string } }

export async function generateQrCodeDataUrl(text: string, options?: QrOptions): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options?.width ?? 256, margin: options?.margin ?? 2,
    color: { dark: options?.color?.dark ?? '#000000', light: options?.color?.light ?? '#ffffff' },
  })
}

export async function generateQrCodeCanvas(text: string, canvas: HTMLCanvasElement, options?: QrOptions): Promise<void> {
  await QRCode.toCanvas(canvas, text, {
    width: options?.width ?? 256, margin: options?.margin ?? 2,
    color: { dark: options?.color?.dark ?? '#000000', light: options?.color?.light ?? '#ffffff' },
  })
}
