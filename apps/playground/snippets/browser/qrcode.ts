/* ---
title: Draw a QR code in the page
entry: qrcode/generateQrCodeDataUrl
output: preview
--- */
import { generateQrCodeDataUrl } from '@smartdevutils/browser/qrcode'

const url = 'https://smartdevutils.com/playground/'
const png = await generateQrCodeDataUrl(url, { width: 224, margin: 2, color: { dark: '#1a1d23', light: '#ffffff' } })

const img = document.createElement('img')
img.src = png
img.alt = `QR code for ${url}`
img.width = 224
img.height = 224
document.body.append(img)
console.log(`PNG data URL, ${png.length} characters`)
