# @smartdevutils/react

Drop-in React panels for 36 [SmartDevUtils](https://smartdevutils.com) tools: hashing, Base64, JSON, colour, JWT, regex, UUIDs and more. They are built on `@smartdevutils/core` and `@smartdevutils/browser`.

## Install

```bash
npm i @smartdevutils/react react react-dom
```

`@smartdevutils/core` and `@smartdevutils/browser` are installed with it and imported from there, not copied into this package. Your bundler loads only the core modules the components you use need. React 18 and 19 are supported.

## Usage

```tsx
import { HashGenerator, Base64Encoder, JsonFormatter, ContrastChecker } from '@smartdevutils/react'

export function Tools() {
  return (
    <>
      <HashGenerator defaultAlgorithm="sha256" onResult={(hash) => console.log(hash)} />
      <Base64Encoder />
      <JsonFormatter onResult={(json) => console.log(json)} />
      <ContrastChecker />
    </>
  )
}
```

The components are styled with Tailwind utility classes, including `dark:` variants. Add the package to your Tailwind `content` list:

```js
// tailwind.config.js
content: ['./src/**/*.{ts,tsx}', './node_modules/@smartdevutils/react/dist/**/*.js']
```

Hooks are available from `@smartdevutils/react/hooks` (`useHashGenerator`, `useBase64`).

## Components

`HashGenerator`, `Base64Encoder`, `Base64FileDrop`, `BaseConverter`, `ByteSizeConverter`, `CaseConverter`, `ChmodCalculator`, `ColorBlindnessSimulator`, `ColorConverter`, `ColorPalette`, `ContrastChecker`, `CspBuilder`, `CssFormatter`, `FakeDataGenerator`, `HtmlEncoder`, `IpInspector`, `JsFormatter`, `JsonCsvConverter`, `JsonDiff`, `JsonFormatter`, `JwtDecoder`, `LoremIpsumGenerator`, `PassphraseGenerator`, `PasswordGenerator`, `QrCodeGenerator`, `RegexTester`, `SecretScanner`, `SemverCalculator`, `SlugGenerator`, `SqlFormatter`, `TextCounter`, `TextDiff`, `TimestampConverter`, `TokenEstimator`, `UrlEncoder`, `UuidGenerator`, plus the building blocks `ToolPanel`, `CopyButton` and `ErrorDisplay`.

## Generic components: `SduTool`, `SduDiagram`, `SduRecipe`, `SduRecipeRun`

These four components match `@smartdevutils/elements` and `@smartdevutils/angular`. They are built on the tool runners in `@smartdevutils/core/tools`, the recipe engine in `@smartdevutils/recipes`, and lazy Mermaid rendering from `@smartdevutils/browser/mermaid`. They use the plain `.sdu-*` classes from `@smartdevutils/theme`, not Tailwind. Import the stylesheet once:

```tsx
import '@smartdevutils/theme/styles.css'
import { SduTool, SduDiagram, SduRecipe, SduRecipeRun, setMermaidLoader } from '@smartdevutils/react'

setMermaidLoader(() => import('mermaid')) // optional: use your installed mermaid instead of the CDN build

export function Page() {
  const [text, setText] = useState('aGVsbG8=')
  const [run, setRun] = useState<RecipeRun | null>(null)
  return (
    <>
      <SduTool tool="base64-encoder-decoder" defaultMode="decode" value={text} onChange={setText} onResult={(r) => console.log(r.output)} />
      <SduDiagram source="graph LR; Build-->Test-->Deploy" label="Pipeline" />
      <SduRecipe recipe="decode-base64-json-param" onRun={setRun} />
      <SduRecipeRun run={run} upload />
    </>
  )
}
```

- **`SduTool`** works with any tool that has a runner.
  - Props: `tool`, controlled `value`/`onChange` and `mode`/`onModeChange` (or `defaultValue`/`defaultMode`), `options`, `manual`, `readOnly`, `compact`, `label`, `theme`, `className`, `onResult` and `onError`.
  - It runs as you type (after 200 ms) unless `manual` is set.
  - Mode tabs follow the WAI-ARIA tabs pattern (arrow keys, Home, End).
- **`SduDiagram`** draws in the browser only, with `securityLevel: 'strict'`, and offers SVG and PNG download.
  - Props: `source`, `label`, `theme`, `className` and `onRendered`.
  - During server rendering it outputs the frame and the source, not the SVG.
- **`SduRecipe`** shows the steps, Run all, and per step the input, the output and "what changed". You can edit a step and run again from it, and download or upload `sdu-recipe-run/1` files.
  - Props: `recipe` or `steps`, `name`, `defaultInput`, `label`, `theme`, `className`, `onStep` and `onRun`.
- **`SduRecipeRun`** shows a run read-only.
  - Props: `run` or `fileText`, `upload`, `label`, `theme`, `className`, `onRun` and `onError`.
- **Light and dark:** set `theme="light|dark"` on a component, or `data-theme` on any ancestor; otherwise the OS setting applies. Restyle with the `--sdu-*` custom properties (see the theme README).

Tools with runners today (20): `base64-encoder-decoder`, `url-encoder-decoder`, `json-formatter`, `hash-generator`, `uuid-generator`, `sql-create-table`, `ddl-diff`, `index-advisor`, `slow-query-detector`, `migration-generator`, `cicd-pipeline-builder`, `k8s-yaml-validator`, `docker-tag-checker`, `log-parser`, `system-prompt-analyzer`, `training-data-formatter`, `gantt-generator`, `sprint-velocity`, `boundary-value-analyzer`, `performance-sla-checker`. Recipes that run today: `decode-base64-json-param` and `json-to-base64-env`.

To run a tool without UI, or to chain tools, use the runners in `@smartdevutils/core/tools` and the engine in `@smartdevutils/recipes`.

## Licence

MIT © ArchitonixLabs
