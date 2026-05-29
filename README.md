# SmartDevUtils Packages

Open-source npm packages extracted from [SmartDevUtils](https://smartdevutils.com) — 100+ developer tools, offline, no tracking.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`@smartdevutils/core`](./packages/core) | Pure TypeScript utilities — hashing, encoding, color, data, network, and more (22 modules) | `npm i @smartdevutils/core` |
| [`@smartdevutils/browser`](./packages/browser) | Browser-only utilities — QR code, clipboard, file handling, accessibility | `npm i @smartdevutils/core @smartdevutils/browser` |
| [`@smartdevutils/react`](./packages/react) | React component library — 36 drop-in UI panels | `npm i @smartdevutils/core @smartdevutils/browser @smartdevutils/react` |

## Dependency Graph

```
@smartdevutils/core          (zero deps on other @smartdevutils/* packages)
       ↑
@smartdevutils/browser       (depends on core)
       ↑
@smartdevutils/react         (depends on core + browser; peers: react, react-dom)
```

## Quick Start

### Core (Node.js / Browser / Edge)

```ts
import { sha256 } from '@smartdevutils/core/hashing'
import { hexToRgb, contrastRatio } from '@smartdevutils/core/color'
import { jsonToCsv } from '@smartdevutils/core/data'
import { chmodToString } from '@smartdevutils/core/developer'

sha256('hello world')
// → '2cf24dba...'

hexToRgb('#ff0000')
// → { r: 255, g: 0, b: 0 }

contrastRatio('#000000', '#ffffff')
// → 21

chmodToString('755')
// → 'rwxr-xr-x'
```

### Browser

```ts
import { generateQrCodeDataUrl } from '@smartdevutils/browser/qrcode'
import { copyToClipboard } from '@smartdevutils/browser/clipboard'
import { fileToBase64 } from '@smartdevutils/browser/file'

const dataUrl = await generateQrCodeDataUrl('https://smartdevutils.com')
```

### React

```tsx
import {
  HashGenerator,
  ColorConverter,
  ContrastChecker,
  ChmodCalculator,
  JsonCsvConverter,
  TokenEstimator,
} from '@smartdevutils/react'

// Add to tailwind.config.js content:
// './node_modules/@smartdevutils/react/dist/**/*.js'

function App() {
  return (
    <>
      <HashGenerator defaultAlgorithm="sha256" onResult={(hash) => console.log(hash)} />
      <ColorConverter defaultHex="#3b82f6" />
      <ContrastChecker foreground="#000000" background="#ffffff" />
      <ChmodCalculator defaultOctal="755" />
      <JsonCsvConverter />
      <TokenEstimator model="claude-3-5-sonnet" />
    </>
  )
}
```

## Core Modules (22)

| Module | Key Exports |
|--------|-------------|
| `encoding` | base64, url, html encode/decode |
| `hashing` | md5, sha1, sha256, sha512 |
| `formatting` | JSON format/minify, HTML prettify |
| `generation` | UUID, timestamp, lorem, password, passphrase |
| `text` | case convert, slug, sort, dedup, word count |
| `formats` | YAML, XML, TOML, CSS, JS, SQL format/minify |
| `jwt` | JWT decode |
| `dba` | JSON→SQL, connection string parse |
| `devops` | .env→JSON, CIDR expand |
| `aiml` | token count, prompt clean, JSONL |
| `security` | secret scan, HMAC-SHA256, SHA-384 |
| `database` | DDL generate, diff, migration |
| `devops-tools` | CI/CD pipeline, Docker, K8s |
| `aiml-tools` | token estimate by model, prompt analysis |
| `planning` | Gantt (Mermaid), velocity, SLA |
| `color` | hex/rgb/hsl/lab conversions, contrast, WCAG |
| `network` | IP parse, HTTP headers, status codes |
| `data` | JSON↔CSV, fake data generation |
| `text-extra` | readability, markdown↔html, null detect |
| `developer` | chmod, base convert, semver, bitwise, IEEE754 |
| `security-extra2` | CSP build/validate, CORS parse, git commit lint |

## License

MIT © ArchitonixLabs
