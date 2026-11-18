# SmartDevUtils Packages

Open-source npm packages taken from [SmartDevUtils](https://smartdevutils.com), a site of 200+ developer tools that run in the browser with no tracking.

## Packages

| Package | What it is | Install |
|---------|-----------|---------|
| [`@smartdevutils/core`](./packages/core) | Plain TypeScript utilities (22 modules), headless **tool runners** (`/tools`) and **Mermaid diagram builders** (`/diagrams`) | `npm i @smartdevutils/core` |
| [`@smartdevutils/recipes`](./packages/recipes) | The 55 built-in recipes (tool chains) as data, plus an engine that runs them headless and writes `sdu-recipe-run/1` files | `npm i @smartdevutils/recipes` |
| [`@smartdevutils/browser`](./packages/browser) | Browser-only helpers: QR codes, clipboard, files, accessibility checks, lazy Mermaid rendering | `npm i @smartdevutils/browser` |
| [`@smartdevutils/react`](./packages/react) | 36 drop-in React tool panels, plus generic `SduTool`, `SduDiagram`, `SduRecipe` and `SduRecipeRun` | `npm i @smartdevutils/react` |
| [`@smartdevutils/elements`](./packages/elements) | Web Components (Lit) for any framework or plain HTML: `<sdu-tool>`, `<sdu-diagram>`, `<sdu-recipe>`, `<sdu-recipe-run>`, with npm and single-file CDN builds | `npm i @smartdevutils/elements` |
| [`@smartdevutils/angular`](./packages/angular) | Standalone components for Angular 19 to 22, with signal inputs, safe for server rendering | `npm i @smartdevutils/angular` |
| [`@smartdevutils/theme`](./packages/theme) | The shared CSS: `--sdu-*` tokens (light and dark) and `.sdu-*` classes, no Tailwind | `npm i @smartdevutils/theme` |

Every package needs Node 20.19 or later and keeps its dependencies as dependencies instead of copying them into `dist`. core, recipes, browser, react and theme ship ESM and CommonJS builds with types; elements and angular ship ES modules with types.

## How they depend on each other

```
@smartdevutils/core          (no other @smartdevutils package)
   ↑            ↑
   │   @smartdevutils/recipes   (core)
   │
@smartdevutils/browser       (core)
   ↑
@smartdevutils/react         (core, browser, recipes, theme; peers: react, react-dom)
@smartdevutils/elements      (core, browser, recipes, theme, lit; optional peer: mermaid)
@smartdevutils/angular       (core, browser, recipes, theme; peers: @angular/core, common, platform-browser)
@smartdevutils/theme         (no dependencies)
```

Working examples for plain HTML, Vue, React, Angular 19 and Angular 22 with server rendering are in [`examples/`](./examples).

## Quick start

```ts
// Utilities
import { sha256 } from '@smartdevutils/core/hashing'
sha256('hello world') // '2cf24dba…'

// Run a website tool headless, with the website's modes and options
import { runTool } from '@smartdevutils/core/tools'
await runTool('base64-encoder-decoder', 'aGVsbG8=', { mode: 'decode' }) // { output: 'hello' }

// Diagrams as Mermaid text
import { ddlToErd } from '@smartdevutils/core/diagrams'
ddlToErd('CREATE TABLE users (id INT PRIMARY KEY);', 'mermaid').output // 'erDiagram …'

// Run a recipe and save the run in the website's format
import { getRecipe, runRecipe, runFileText } from '@smartdevutils/recipes'
const run = await runRecipe(getRecipe('decode-base64-json-param')!)
runFileText(run) // upload it on smartdevutils.com/recipes/run
```

```html
<!-- Any page, no build step -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@smartdevutils/elements@0/dist/cdn/sdu-elements.js"></script>
<sdu-tool tool="base64-encoder-decoder" mode="decode" value="aGVsbG8="></sdu-tool>
<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>
<sdu-diagram source="graph LR; Build-->Test-->Deploy"></sdu-diagram>
```

Today 20 tools have runners and 2 of the 55 built-in recipes run headless. The package READMEs list them.

## Core modules

Each module is its own entry point, for example `@smartdevutils/core/color`.

| Module | Key exports |
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
| `tools` | headless tool runners: `runTool`, `loadRunner`, `TOOL_SPECS` |
| `diagrams` | Mermaid builders: ER diagrams, schema changes, Compose, Kubernetes, GitHub Actions, charts |

## Development

```bash
pnpm install
pnpm build            # all packages, then the example apps (turbo)
pnpm test             # all tests
pnpm test:coverage    # tests plus lcov per package (for SonarQube)
pnpm lint             # type check
pnpm size             # size budgets per entry point (size-budgets.json)
pnpm check:dist       # every export loads through import() (and require() where there is CommonJS)
pnpm e2e:ui           # the example apps in Microsoft Edge, headless (after pnpm build)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for changesets.

## Releases

Publishing to npm happens only through the **Release** workflow:

1. You start it by hand, from `main`.
2. Its publish job waits for the owner's approval in the `npm-publish` GitHub Environment.
3. A dry run is the default.

Tags no longer publish. `pnpm release` deliberately fails locally.

## License

MIT © ArchitonixLabs
