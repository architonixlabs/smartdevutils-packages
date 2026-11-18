# @smartdevutils/browser

Browser-only helpers from [SmartDevUtils](https://smartdevutils.com): QR codes, the clipboard, file handling, accessibility checks, colour-blindness simulation and user-agent parsing. These need a DOM. For code that runs anywhere, use `@smartdevutils/core`.

## Install

```bash
npm i @smartdevutils/browser
```

`@smartdevutils/core` is installed with it. axe-core, DOMPurify, qrcode and ua-parser-js are normal dependencies. They are not copied into this package, so your bundler can share them with the rest of your app.

## Usage

```ts
import { generateQrCodeDataUrl } from '@smartdevutils/browser/qrcode'
import { copyToClipboard } from '@smartdevutils/browser/clipboard'
import { fileToBase64, downloadBlob } from '@smartdevutils/browser/file'
import { checkHtmlAccessibility } from '@smartdevutils/browser/accessibility'
import { parseUserAgent } from '@smartdevutils/browser/user-agent'

const png = await generateQrCodeDataUrl('https://example.com', { width: 256 })
await copyToClipboard('copied text')
const report = await checkHtmlAccessibility('<img src="logo.png">') // { score, violations, warnings }
parseUserAgent(navigator.userAgent) // { browser, version, os, device }
```

| Entry point | Exports |
|---|---|
| `qrcode` | `generateQrCodeDataUrl`, `generateQrCodeCanvas` |
| `clipboard` | `copyToClipboard`, `readFromClipboard` |
| `file` | `fileToBase64`, `base64ToBlob`, `downloadBlob`, `readFileAsText` |
| `accessibility` | `checkHtmlAccessibility`, `getWcagViolations` (axe-core) |
| `color-blindness` | `simulateProtanopia`, `simulateDeuteranopia`, `simulateTritanopia` (on `ImageData`) |
| `user-agent` | `parseUserAgent`, `detectBrowser`, `detectOs` |

`accessibility` loads axe-core, which is large. Import that entry point only on pages that need it.

## Licence

MIT © ArchitonixLabs. axe-core, a dependency, is licensed MPL-2.0.
