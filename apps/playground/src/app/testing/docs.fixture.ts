// Small, realistic docs data for unit tests and local development before scripts/build-docs.mjs has
// written src/assets/docs.json. The app itself always loads assets/docs.json.
import type { PlaygroundDocs } from '../core/model'

export const DOCS_FIXTURE: PlaygroundDocs = {
  generatedAt: '2026-11-27T12:00:00.000Z',
  version: '1.3.0',
  packages: [
    {
      name: '@smartdevutils/core',
      id: 'core',
      version: '1.3.0',
      description:
        'Pure TypeScript utilities and headless tool runners for SmartDevUtils: hashing, encoding, formatting and more.',
      install: 'npm install @smartdevutils/core',
      exports: ['.', './encoding', './hashing', './tools'],
      changelog: '## 1.3.0\n\n- Added `contrastRatio` to `color`.\n- Tool runners accept `signal` for cancellation.',
      frameworks: ['node', 'browser'],
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          kind: 'overview',
          markdown:
            '# @smartdevutils/core\n\nPlain TypeScript utilities from [SmartDevUtils](https://smartdevutils.com).\n\n```ts\nimport { sha256 } from \'@smartdevutils/core/hashing\'\n```\n',
          items: [],
        },
        {
          id: 'encoding',
          title: 'encoding',
          kind: 'module',
          items: [
            {
              id: 'base64encode',
              name: 'base64Encode',
              kind: 'function',
              module: '@smartdevutils/core/encoding',
              summary: 'Encodes a UTF-8 string as Base64.',
              docs: 'Unicode-safe: the string is encoded as UTF-8 first.\n\nPass `{ urlSafe: true }` for the URL-safe alphabet.',
              signature: 'function base64Encode(input: string, options?: { urlSafe?: boolean }): string',
              params: [
                { name: 'input', type: 'string', optional: false, description: 'Text to encode.' },
                { name: 'options', type: '{ urlSafe?: boolean }', optional: true },
              ],
              returns: 'string',
              snippets: [
                {
                  id: 'basic',
                  title: 'Encode a string',
                  lang: 'ts',
                  code: "import { base64Encode } from '@smartdevutils/core/encoding'\n\nconsole.log(base64Encode('{\"user\":\"ada\"}'))\n",
                  mode: 'run',
                  output: 'console',
                  source: 'generated',
                  node: true,
                },
                {
                  id: 'url-safe',
                  title: 'URL-safe',
                  lang: 'js',
                  code: "import { base64Encode } from '@smartdevutils/core/encoding'\n\nexport default base64Encode('a?b=c', { urlSafe: true })\n",
                  mode: 'run',
                  output: 'console',
                  source: 'curated',
                  node: true,
                },
              ],
            },
            {
              id: 'base64decode',
              name: 'base64Decode',
              kind: 'function',
              module: '@smartdevutils/core/encoding',
              summary: 'Decodes Base64 to a UTF-8 string.',
              signature: 'function base64Decode(input: string): string',
              params: [{ name: 'input', type: 'string', optional: false }],
              returns: 'string',
              snippets: [],
            },
          ],
        },
        {
          id: 'hashing',
          title: 'hashing',
          kind: 'module',
          items: [
            {
              id: 'sha256',
              name: 'sha256',
              kind: 'function',
              module: '@smartdevutils/core/hashing',
              summary: 'SHA-256 digest of a string, as lowercase hex.',
              signature: 'function sha256(input: string): string',
              params: [{ name: 'input', type: 'string', optional: false }],
              returns: 'string',
              snippets: [
                {
                  id: 'basic',
                  title: 'Hash a string',
                  lang: 'ts',
                  code: "import { sha256 } from '@smartdevutils/core/hashing'\n\nconsole.log(sha256('hello world'))\n",
                  mode: 'run',
                  output: 'console',
                  source: 'readme',
                  node: true,
                },
              ],
            },
            {
              id: 'hashalgorithm',
              name: 'HashAlgorithm',
              kind: 'type',
              module: '@smartdevutils/core/hashing',
              summary: 'Supported hash algorithm names.',
              signature: "type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'",
              snippets: [],
            },
          ],
        },
        {
          id: 'tools',
          title: 'Tools',
          kind: 'tools',
          items: [
            {
              id: 'base64-encoder-decoder',
              name: 'Base64 Encoder / Decoder',
              kind: 'tool',
              module: '@smartdevutils/core/tools',
              summary: 'Encode text to Base64 or decode it back.',
              webUrl: 'https://smartdevutils.com/tools/base64-encoder-decoder',
              snippets: [
                {
                  id: 'run',
                  title: 'runTool',
                  lang: 'ts',
                  code: "import { runTool } from '@smartdevutils/core/tools'\n\nconst res = await runTool('base64-encoder-decoder', 'aGVsbG8gd29ybGQ=', { mode: 'decode' })\nconsole.log(res.output)\n",
                  mode: 'run',
                  output: 'console',
                  source: 'generated',
                  node: true,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: '@smartdevutils/elements',
      id: 'elements',
      version: '1.3.0',
      description: 'Web Components (Lit) for SmartDevUtils: <sdu-tool>, <sdu-diagram> and <sdu-recipe>.',
      install: 'npm install @smartdevutils/elements',
      exports: ['.', './tool', './diagram'],
      frameworks: ['html', 'browser', 'react', 'angular'],
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          kind: 'overview',
          markdown: '# @smartdevutils/elements\n\nWeb Components that work in any framework.',
          items: [],
        },
        {
          id: 'elements',
          title: 'Elements',
          kind: 'elements',
          items: [
            {
              id: 'sdu-tool',
              name: '<sdu-tool>',
              kind: 'element',
              module: '@smartdevutils/elements/tool',
              summary: 'Renders any SmartDevUtils tool from its spec.',
              signature: '<sdu-tool tool="…" mode="…" value="…">',
              docs: '| Attribute | |\n|---|---|\n| `tool` | Tool id. Required |\n| `mode` | Mode id |',
              snippets: [
                {
                  id: 'basic',
                  title: 'Decode Base64',
                  lang: 'html',
                  code: '<sdu-tool tool="base64-encoder-decoder" mode="decode" value="aGVsbG8="></sdu-tool>\n\n<script type="module">\n  import \'@smartdevutils/elements/tool\'\n  const el = document.querySelector(\'sdu-tool\')\n  el.addEventListener(\'sdu-output\', (e) => console.log(e.detail.output))\n</script>\n',
                  mode: 'run',
                  output: 'preview',
                  source: 'readme',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: '@smartdevutils/react',
      id: 'react',
      version: '1.3.0',
      description: 'React components for SmartDevUtils tools.',
      install: 'npm install @smartdevutils/react',
      exports: ['.', './hooks'],
      frameworks: ['react'],
      sections: [
        {
          id: 'components',
          title: 'Components',
          kind: 'components',
          items: [
            {
              id: 'sdutool',
              name: 'SduTool',
              kind: 'component',
              module: '@smartdevutils/react',
              summary: 'React wrapper for <sdu-tool>.',
              signature: 'function SduTool(props: SduToolProps): JSX.Element',
              snippets: [
                {
                  id: 'basic',
                  title: 'Base64 tool',
                  lang: 'tsx',
                  code: "import { SduTool } from '@smartdevutils/react'\n\nexport default function App() {\n  return <SduTool tool=\"base64-encoder-decoder\" defaultMode=\"decode\" />\n}\n",
                  mode: 'run',
                  output: 'preview',
                  source: 'curated',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: '@smartdevutils/angular',
      id: 'angular',
      version: '1.3.0',
      description: 'Angular standalone components for SmartDevUtils.',
      install: 'npm install @smartdevutils/angular',
      exports: ['.'],
      frameworks: ['angular'],
      sections: [
        {
          id: 'components',
          title: 'Components',
          kind: 'components',
          items: [
            {
              id: 'sdutoolcomponent',
              name: 'SduToolComponent',
              kind: 'component',
              module: '@smartdevutils/angular',
              summary: 'Standalone <sdu-tool> component with signal inputs.',
              signature: 'selector: sdu-tool',
              snippets: [
                {
                  id: 'basic',
                  title: 'Standalone component',
                  lang: 'ts',
                  code: "import { Component } from '@angular/core'\nimport { SduToolComponent } from '@smartdevutils/angular'\n\n@Component({\n  selector: 'app-root',\n  imports: [SduToolComponent],\n  template: `<sdu-tool tool=\"base64-encoder-decoder\" />`,\n})\nexport class AppComponent {}\n",
                  mode: 'docs',
                  output: 'console',
                  source: 'curated',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
