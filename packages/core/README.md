# @smartdevutils/core

Plain TypeScript utilities from [SmartDevUtils](https://smartdevutils.com), the functions behind the website's tools. They run in Node 20.19+, browsers, workers and edge runtimes. There is no DOM, no framework and no network access.

The package has three parts:

- **Utility modules** such as `@smartdevutils/core/hashing` or `@smartdevutils/core/database`.
- **Tool runners** in `@smartdevutils/core/tools`. Each one runs a website tool by id, with the same modes and options as the website.
- **Diagram builders** in `@smartdevutils/core/diagrams`. They turn DDL, Docker Compose, Kubernetes YAML, GitHub Actions workflows and tables into Mermaid text.

## Install

```bash
npm i @smartdevutils/core
```

You need Node 20.19 or later (or 22.12+), because some dependencies are ESM-only and the CommonJS build loads them with `require()`. Both `import` and `require` work.

## Utility modules

```ts
import { sha256 } from '@smartdevutils/core/hashing'
import { base64Encode } from '@smartdevutils/core/encoding'
import { contrastRatio } from '@smartdevutils/core/color'
import { diffDdlStatements } from '@smartdevutils/core/database'

sha256('hello world')               // '2cf24dba…'
base64Encode('{"user":"ada"}')      // 'eyJ1c2VyIjoiYWRhIn0='
contrastRatio('#000000', '#ffffff') // 21
```

| Module | What it covers |
|---|---|
| `encoding` | Base64, URL and HTML encode/decode, string escape |
| `hashing` | md5, sha1, sha256, sha512 |
| `formatting` | JSON format and minify, HTML prettify |
| `formats` | YAML, XML, TOML, CSS, JS and SQL format and minify, JSON to TypeScript and JSON Schema |
| `generation` | UUID, timestamp, lorem ipsum, password, passphrase |
| `text`, `text-extra` | Case conversion, slugs, sorting, word count, readability, Markdown to HTML |
| `jwt` | JWT decode |
| `dba`, `database` | JSON to SQL, connection strings, CREATE TABLE, DDL diff, migrations, index advice, slow-query patterns |
| `devops`, `devops-tools` | .env to JSON, CIDR, CI/CD pipelines, Docker image pinning, Kubernetes checks, log parsing |
| `aiml`, `aiml-tools` | Token estimates, prompt analysis, fine-tuning JSONL |
| `security`, `security-extra2` | Secret scanning, HMAC, CSP and CORS, commit message lint |
| `planning` | Gantt (Mermaid), sprint velocity, SLA percentiles |
| `color`, `network`, `data`, `developer` | Colour conversion and WCAG contrast, IP parsing, JSON and CSV, fake data, chmod, semver |

Each module is its own entry point, so importing one pulls in only that module and its own dependencies. Dependencies are installed from npm and are not copied into this package.

## Tool runners: `@smartdevutils/core/tools`

A runner runs one website tool headless. Its modes and options mean what they mean on the website, and its `output` is the text the website shows in its output panel. That makes runners safe to chain, which is how `@smartdevutils/recipes` uses them.

```ts
import { loadRunner, runTool, TOOL_SPECS } from '@smartdevutils/core/tools'

const base64 = await loadRunner('base64-encoder-decoder')
const res = await base64.run('aGVsbG8gd29ybGQ=', { mode: 'decode' })
// { output: 'hello world' }

// Or in one call. A missing runner comes back as `error` instead of throwing.
await runTool('json-formatter', '{"a":1}', { mode: 'minify' })

// Import one runner directly, without the registry:
import { runner as urlRunner } from '@smartdevutils/core/tools/url-encoder-decoder'
urlRunner.run('a b&c', { mode: 'encode', options: { encodeMode: 'component' } })
```

### The contract

```ts
interface ToolSpec {
  id: string            // website tool id, e.g. 'json-formatter'
  slug: string          // website path: smartdevutils.com/tools/<slug>
  name: string
  category: string
  toolType: 'bidirectional' | 'single' | 'generator' | 'analyzer' | 'formatter' | 'compare'
  modes: { id: string; label: string; inputLabel?: string; outputLabel?: string }[]
  defaultMode?: string  // the website's first mode
  input: { kind: 'text' | 'json' | 'yaml' | 'sql' | 'csv' | 'log' | 'none'; label?: string }
  options: { key: string; label: string; type: 'select' | 'text' | 'textarea' | 'number' | 'boolean' | 'json';
             default?: unknown; choices?: { value: string; label: string }[]; modes?: string[] }[]
  output: 'text' | 'report'
  runtime?: ('dom' | 'worker' | 'wasm' | 'network' | 'canvas' | 'speech')[]
}

interface ToolRunner {
  spec: ToolSpec
  run(input: string, ctx?: { mode?: string; options?: Record<string, unknown>; signal?: AbortSignal })
    : ToolRunResult | Promise<ToolRunResult>
}

interface ToolRunResult { output: string; error?: string; meta?: Record<string, unknown> }
```

Every runner follows the same rules:

- `run()` never throws for bad input. Problems come back as `error`, usually with `output: ''`.
- Blank input gives `{ output: '' }`, as on the website. Generators that work from options alone are the exception.
- An unknown mode is an error; the runner never quietly picks another mode.
- Options start from the spec defaults and unknown keys are ignored. Option keys are the website's own setting names, so recipe options work the same in both places.
- `output: 'report'` tools (analyzers) return a readable plain-text report in `output` and the same findings as data in `meta`. On the website these tools show a report and have no output panel, so the report text is a format defined by this package.
- Tools with two inputs (ddl-diff, migration-generator) take the "before" text as `input` and the "after" text as the `after` option.

Other exports: `TOOL_SPECS`, `RUNNABLE_TOOL_IDS`, `getToolSpec(idOrSlug)`, `hasRunner(idOrSlug)`, `runTool()` and `defineRunner()` (for writing your own runner with the same rules).

### Runnable tools today (20)

| Tool id | Modes | Options | Input | Output |
|---|---|---|---|---|
| `url-encoder-decoder` | `encode`, `decode` | `encodeMode` (component, full, query), `batchMode` | text | text |
| `base64-encoder-decoder` | `encode`, `decode` | `variant` (standard, urlsafe, urlsafe-nopad), `wrapOutput` | text | text |
| `json-formatter` | `format`, `minify`, `validate` | none | json | text |
| `uuid-generator` | `generate` | `version` (v4, v1, v7, v5), `count`, `namespace`, `v5name`, `outputFormat` | none | text |
| `hash-generator` | `md5`, `sha1`, `sha256`, `sha384`, `sha512`, `hmac-sha256`, `hmac-sha384`, `hmac-sha512` | `uppercase`, `secretKey` | text | text |
| `sql-create-table` | none | `dialect`, `tableName`, `columns` (or JSON input) | json | text |
| `ddl-diff` | none | `after`, `scope` | sql | report |
| `index-advisor` | none | none | sql | report |
| `slow-query-detector` | none | none | sql | report |
| `migration-generator` | none | `after`, `dialect`, `part` (up, down, both) | sql | text |
| `cicd-pipeline-builder` | none | `language`, `platform`, `steps`, `imageName`, `deployCommand`, `branch` | none | text |
| `k8s-yaml-validator` | none | none | yaml | report |
| `docker-tag-checker` | none | none | text | report |
| `log-parser` | none | `levelFilter` | log | report |
| `system-prompt-analyzer` | none | none | text | report |
| `training-data-formatter` | none | `format` (openai, anthropic) | json | text |
| `gantt-generator` | none | none (JSON task list as input) | json | text |
| `sprint-velocity` | none | none (numbers as input) | text | report |
| `boundary-value-analyzer` | none | `fieldName`, `fieldType`, `min`, `max` | none | report |
| `performance-sla-checker` | none | `p50Target`, `p95Target`, `p99Target` | text | report |

The other website tools do not have runners yet. They are added in batches, and their logic moves from the website into core as they are.

### Tool catalog: `@smartdevutils/core/tools/catalog`

`TOOL_CATALOG` lists all 210 website tools, runnable or not: id, slug, name, category, tool type, short description and modes. `findToolById` and `findToolBySlug` look tools up. It is about 25 kB gzipped, so it has its own entry point. Regenerate it from the website registry with:

```bash
node scripts/gen-tool-catalog.mjs <path to SmartDevUtils.Client/src/app>
```

## Diagrams: `@smartdevutils/core/diagrams`

These are pure builders that return Mermaid (or DBML) **text**. Mermaid itself is not a dependency. Render the text with Mermaid in the browser (use `securityLevel: 'strict'`), or paste it into any Markdown that supports Mermaid.

```ts
import { ddlToErd } from '@smartdevutils/core/diagrams'

const erd = ddlToErd(`
  CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(200));
  CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));
`, 'mermaid')
// erd.success === true; erd.output is the Mermaid text, starting with 'erDiagram'
```

| Builder | Input | Output |
|---|---|---|
| `ddlToErd(ddl, 'mermaid' \| 'dbml')`, `parseDdl` | SQL `CREATE TABLE` statements | ER diagram or DBML |
| `buildDdlChangeDiagram` | Two DDL versions | ER diagram of what changed |
| `composeToMermaid`, `composeTextToMermaid` | Docker Compose YAML | Service, network and volume graph |
| `k8sToMermaid`, `k8sResources` | Kubernetes YAML | Resource map |
| `parseWorkflow`, `analyzeWorkflow`, `workflowToMermaid`, `visualizeWorkflow` | GitHub Actions workflow YAML | Job graph and findings |
| `buildChart`, `parseTable`, `suggestChart` | CSV, TSV, JSON or Markdown tables | Mermaid charts (xychart, pie, quadrant, …) |
| `renderFlowchart` | Nodes, groups and edges | Flowchart, capped at `DIAGRAM_CAP` nodes |
| `extractMermaidBlocks`, `splitPreview` | Markdown | The ```mermaid blocks it contains |
| `MERMAID_TEMPLATES`, `detectDiagramType`, `encodeShareFragment`, `decodeShareFragment` | Mermaid text | Helpers from the Mermaid live editor |
| `generateGanttMermaid` | Task list | Gantt chart |

## Licence

MIT © ArchitonixLabs
