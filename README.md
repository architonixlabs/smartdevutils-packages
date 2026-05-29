# SmartDevUtils npm Packages

Open-source utility packages from [SmartDevUtils](https://smartdevutils.com) — 21+ developer tools available as npm packages.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@smartdevutils/core`](./packages/core) | Pure TypeScript utility functions (zero dependencies on UI/framework) | [![npm](https://img.shields.io/npm/v/@smartdevutils/core)](https://www.npmjs.com/package/@smartdevutils/core) |
| [`@smartdevutils/react`](./packages/react) | React component library — drop-in UI panels styled with Tailwind CSS | [![npm](https://img.shields.io/npm/v/@smartdevutils/react)](https://www.npmjs.com/package/@smartdevutils/react) |

## Quick Start: `@smartdevutils/core`

```bash
npm install @smartdevutils/core
# or
pnpm add @smartdevutils/core
```

```ts
import { hashSha256 } from '@smartdevutils/core/hashing'
import { base64Encode } from '@smartdevutils/core/encoding'
import { formatJson } from '@smartdevutils/core/formatting'
import { generateUuid } from '@smartdevutils/core/generation'

hashSha256('hello world')
base64Encode('Hello, World!')  // → 'SGVsbG8sIFdvcmxkIQ=='
formatJson('{"a":1}')          // → '{\n  "a": 1\n}'
generateUuid()                 // → 'a4b2c3d4-...'
```

## Quick Start: `@smartdevutils/react`

```bash
npm install @smartdevutils/react @smartdevutils/core react react-dom
```

Add to your `tailwind.config.js`:
```js
content: [
  // your existing paths
  './node_modules/@smartdevutils/react/dist/**/*.js',
]
```

```tsx
import { HashGenerator, JsonFormatter, Base64Encoder } from '@smartdevutils/react'

function App() {
  return (
    <div className="p-4 space-y-4">
      <HashGenerator defaultAlgorithm="sha256" onResult={console.log} />
      <JsonFormatter />
      <Base64Encoder />
    </div>
  )
}
```

## Available Tools

**Encoding:** Base64, URL, HTML, String escape
**Formatting:** JSON, CSS, JavaScript, SQL, YAML, XML, TOML
**Hashing:** MD5, SHA-1, SHA-256, SHA-512
**Generation:** UUID, Timestamp, Lorem Ipsum, Password, Passphrase
**Text:** Case converter, Slug, Word count, Sort lines, Dedup
**Compare:** JSON diff, Text diff
**JWT:** Decode & validate
**Color:** Hex/RGB/HSL conversion, WCAG contrast checker
**DevOps:** ENV parser, CIDR expander, CI/CD generator, K8s validator
**AI/ML:** Token counter, Prompt analyzer, Training data formatter
**Security:** Secret scanner, HMAC, SHA-384
**Database:** DDL generator, Schema diff, Query analyzer
**Planning:** Gantt, Velocity stats, Boundary values

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © [ArchitonixLabs](https://github.com/ArchitonixLabs)
