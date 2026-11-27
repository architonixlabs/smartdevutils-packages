// Generated snippets for API functions that have no curated snippet: import the function, call it
// with example arguments built from its parameters, and print the result. The build runs each one in
// Node and marks `node: true` only when it really runs (see build-docs.mjs).

const K8S = 'apiVersion: apps/v1\\nkind: Deployment\\nmetadata:\\n  name: web\\nspec:\\n  replicas: 2\\n  selector:\\n    matchLabels:\\n      app: web\\n  template:\\n    metadata:\\n      labels:\\n        app: web\\n    spec:\\n      containers:\\n        - name: web\\n          image: nginx:1.27\\n'
const DDL = "CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(200) NOT NULL);\\nCREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id), total DECIMAL(10,2));"
const COMPOSE = 'services:\\n  web:\\n    image: nginx:1.27\\n    ports: ["8080:80"]\\n    depends_on: [api]\\n  api:\\n    image: node:22-alpine\\n    depends_on: [db]\\n  db:\\n    image: postgres:16\\n    volumes: [pgdata:/var/lib/postgresql/data]\\nvolumes:\\n  pgdata: {}\\n'
const WORKFLOW = 'name: CI\\non: [push]\\njobs:\\n  test:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4\\n      - run: npm test\\n  deploy:\\n    needs: test\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: ./deploy.sh\\n'
const TABLE = 'language,users\\nTypeScript,38\\nPython,51\\nGo,14'

/** Example arguments (as source code) per '<package id>:<function name>'. */
export const ARG_OVERRIDES = {
  'core:base64Decode': ["'SGVsbG8sIFNtYXJ0RGV2VXRpbHMh'"],
  'core:urlEncode': ["'name=Ada Lovelace&lang=en'"],
  'core:urlDecode': ["'name%3DAda%20Lovelace%26lang%3Den'"],
  'core:htmlEncode': ["'<p class=\"hero\">Fish & Chips</p>'"],
  'core:htmlDecode': ["'&lt;b&gt;bold&lt;/b&gt; &amp; &copy; 2026'"],
  'core:stringEscape': ["'Line one\\nShe said \"hi\"'"],
  'core:stringUnescape': ["'Line one\\\\nShe said \\\\\"hi\\\\\"'"],
  'core:jsonFormat': ["'{\"id\":42,\"tags\":[\"a\",\"b\"],\"active\":true}'"],
  'core:jsonMinify': ["'{\\n  \"id\": 42,\\n  \"active\": true\\n}'"],
  'core:htmlPrettify': ["'<ul><li>One</li><li>Two</li></ul>'"],
  'core:generateLoremIpsum': ['12'],
  'core:generatePassword': ['20'],
  'core:generatePassphrase': ['5'],
  'core:toCase': ["'user account settings'", "'camel'"],
  'core:slugifyText': ["'Hello, World! Ünïcödé & More'"],
  'core:cleanText': ["'Too    many   spaces\\n\\n\\n\\nand blank lines  '"],
  'core:sortLines': ["'pear\\napple\\nfig'", "'asc'"],
  'core:deduplicateLines': ["'red\\nblue\\nred\\ngreen\\nblue'"],
  'core:wordCount': ["'The quick brown fox jumps over the lazy dog.'"],
  'core:yamlFormat': ["'server:\\n    port: 8080\\n    hosts: [a, b]'"],
  'core:xmlFormat': ["'<note><to>Ada</to><body>Hi</body></note>'"],
  'core:tomlFormat': ["'title=\"demo\"\\n[server]\\nport=8080'"],
  'core:cssFormat': ["'.btn{color:#fff;background:#1d4ed8}'"],
  'core:cssMinify': ["'.btn {\\n  color: #fff;\\n  background: #1d4ed8;\\n}'"],
  'core:jsFormat': ["'function add(a,b){return a+b}'"],
  'core:jsMinify': ["'function add(a, b) {\\n  return a + b\\n}'"],
  'core:sqlFormat': ["'select id, email from users where active = 1 order by email'"],
  'core:sqlMinify': ["'SELECT id,\\n  email\\nFROM users\\nWHERE active = 1'"],
  'core:jsonToTypeScript': ["'{\"id\":1,\"name\":\"Ada\",\"tags\":[\"math\"]}'"],
  'core:jsonSchemaGenerate': ["'{\"id\":1,\"name\":\"Ada\",\"tags\":[\"math\"]}'"],
  'core:jsonToSqlInserts': ["'[{\"id\":1,\"name\":\"Ada\"},{\"id\":2,\"name\":\"Grace\"}]'", "'users'"],
  'core:parseConnectionString': ["'postgres://demo:demo-password@db.example.com:5432/shop'"],
  'core:sanitizeSql': ["\"O'Brien's order\""],
  'core:envToJson': ["'# app settings\\nPORT=8080\\nAPI_URL=\"https://api.example.com\"'"],
  'core:cidrExpand': ["'10.0.0.0/24'"],
  'core:estimateTokenCount': ["'Summarise this paragraph in two sentences for a product manager.'"],
  'core:cleanPrompt': ["'You are   a helpful assistant.\\n\\n\\n\\nAnswer briefly.'"],
  'core:jsonToTrainingJsonl': ["'[{\"prompt\":\"Hi\",\"completion\":\"Hello!\"}]'"],
  'core:scanForSecrets': ["'const region = \"eu-west-1\"\\nconst key = \"AKIA' + 'IOSFODNN7EXAMPLE\"'"],
  'core:hmacSha256': ["'{\"event\":\"order.paid\"}'", "'demo-webhook-secret'"],
  'core:base64UrlDecode': ["'eyJ1c2VyIjoiYWRhIn0'"],
  'core:generateCreateTable': [
    "{ tableName: 'users', columns: [{ name: 'id', type: 'SERIAL', primaryKey: true }, { name: 'email', type: 'VARCHAR(255)', nullable: false }] }",
    "'postgres'",
  ],
  'core:diffDdlStatements': ["'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));'", "'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email TEXT);'"],
  'core:generateMigrationSql': ["'CREATE TABLE users (id INT PRIMARY KEY);'", "'CREATE TABLE users (id INT PRIMARY KEY, email TEXT);'", "'postgres'"],
  'core:detectSlowQueryPatterns': ["\"SELECT * FROM users WHERE email LIKE '%@example.com'\""],
  'core:analyzeQueryForIndexes': ["'SELECT id FROM orders WHERE customer_id = 7 AND status = 1 ORDER BY created_at DESC'"],
  'core:generateCicdPipeline': ["{ language: 'node', platform: 'github-actions', steps: ['install', 'lint', 'test', 'build'] }"],
  'core:detectUnpinnedDockerImages': ["'FROM node:latest\\nFROM nginx\\nFROM postgres:16.4'"],
  'core:parseLogLines': ["'2026-11-27 09:00:01 INFO api started\\n2026-11-27 09:00:04 ERROR db timeout after 5000ms'"],
  'core:validateK8sManifest': [`'${K8S}'`],
  'core:estimateTokensForModel': ["'Translate this sentence into French.'", "'gpt-4o'"],
  'core:analyzeSystemPrompt': ["'You are a support agent for Acme. Answer in under 100 words. Never share account data.'"],
  'core:formatTrainingDataWithReport': ["[{ input: 'What is 2+2?', output: '4' }, { input: '', output: 'missing input' }]", "'openai'"],
  'core:formatTrainingData': ["[{ input: 'What is 2+2?', output: '4', system: 'Answer with a number.' }]", "'anthropic'"],
  'core:generateGanttMermaid': ["[{ title: 'Design', start: '2026-01-05', end: '2026-01-16', section: 'Plan' }, { title: 'Build', start: '2026-01-19', end: '2026-02-13', section: 'Make' }]"],
  'core:computeVelocityStats': ['[21, 24, 19, 26, 23, 25]'],
  'core:computeBoundaryValues': ["{ type: 'integer', min: 18, max: 65 }"],
  'core:computePercentiles': ['[120, 135, 128, 142, 150, 133, 161, 147, 410, 980]', '{ p50: 200, p95: 500, p99: 1000 }'],
  'core:hexToRgb': ["'#1d4ed8'"],
  'core:rgbToHex': ['29', '78', '216'],
  'core:rgbToHsl': ['29', '78', '216'],
  'core:hslToRgb': ['224', '76', '48'],
  'core:hexToHsl': ["'#1d4ed8'"],
  'core:rgbToLab': ['29', '78', '216'],
  'core:contrastRatio': ["'#1d4ed8'", "'#ffffff'"],
  'core:wcagLevel': ['6.7'],
  'core:parseIpAddress': ["'192.168.1.20'"],
  'core:isPrivateIp': ["'10.20.30.40'"],
  'core:ipToInt': ["'192.168.1.20'"],
  'core:intToIp': ['3232235796'],
  'core:parseHttpHeaders': ["'Content-Type: application/json\\nCache-Control: no-store\\nX-Request-Id: demo-123'"],
  'core:classifyHttpStatus': ['404'],
  'core:jsonToCsv': ["[{ id: 1, name: 'Ada', city: 'London' }, { id: 2, name: 'Grace', city: 'New York' }]"],
  'core:csvToJson': ["'id,name,city\\n1,Ada,London\\n2,Grace,New York'"],
  'core:generateFakeRecord': ["{ name: 'fullName', email: 'email', city: 'city' }"],
  'core:generateFakeDataset': ["{ id: 'uuid', name: 'fullName', email: 'email' }", '3'],
  'core:readabilityScore': ["'The cat sat on the mat. It was a sunny day, and the cat was happy.'"],
  'core:csvToMarkdownTable': ["'tool,stars\\nsdu-tool,5\\nsdu-diagram,4'"],
  'core:markdownToHtml': ["'# Release notes\\n\\n- **Fast** builds\\n- `runTool()` helper'"],
  'core:htmlToMarkdown': ["'<h2>Notes</h2><p>Use <strong>runTool</strong> for <em>everything</em>.</p>'"],
  'core:detectNullValues': ["'NULL'"],
  'core:numberFormat': ['1234567.891', "'de-DE'"],
  'core:chmodToString': ["'750'"],
  'core:stringToChmod': ["'rwxr-x---'"],
  'core:umaskToPermissions': ["'027'"],
  'core:convertBase': ["'ff'", '16', '2'],
  'core:formatBytes': ['1536000', '1'],
  'core:parseSemver': ["'2.4.1-beta.3'"],
  'core:compareSemver': ["'1.10.0'", "'1.9.3'"],
  'core:bitwiseOps': ['12', '10'],
  'core:ieee754Inspect': ['0.1'],
  'core:convertEndianness': ["'0a0b0c0d'"],
  'core:buildCspHeader': ["{ defaultSrc: [\"'self'\"], scriptSrc: [\"'self'\", 'https://cdn.example.com'], imgSrc: [\"'self'\", 'data:'] }"],
  'core:validateCsp': ["\"default-src 'self'; script-src 'self' 'unsafe-inline'\""],
  'core:parseCorsPolicy': ["{ 'access-control-allow-origin': 'https://app.example.com', 'access-control-allow-methods': 'GET, POST' }"],
  'core:gitCommitLint': ["'feat(auth): add passkey sign-in'"],
  // core/tools
  'core:getToolSpec': ["'json-formatter'"],
  'core:hasRunner': ["'gzip-compressor'"],
  'core:loadRunner': ["'url-encoder-decoder'"],
  'core:runTool': ["'json-formatter'", "'{\"a\":1,\"b\":[1,2]}'", "{ mode: 'format' }"],
  'core:findToolById': ["'regex-tester'"],
  'core:findToolBySlug': ["'json-formatter-validator-minifier-beautifier'"],
  // core/diagrams
  'core:parseCell': ["'1,234.5'", "'comma'"],
  'core:parseDelimited': ["'a;b;c\\n1;2;3'", "';'"],
  'core:parseNumber': ["'1.234,5'", "'dot'"],
  'core:formatNumber': ['1234.5'],
  'core:niceCeil': ['87'],
  'core:quoteLabel': ["'Q1 \"sales\"'"],
  'core:rawText': ["'Revenue (EUR)'"],
  'core:toAscii': ["'Café Zürich'"],
  'core:csvField': ["'Smith, John'"],
  'core:detectFormat': [`'${TABLE}'`],
  'core:parseTable': [`'${TABLE}'`],
  'core:isDateLike': ["'2026-11-27'"],
  'core:quadrantScale': ['[3, 7, 12, 20]'],
  'core:parseWorkflow': [`'${WORKFLOW}'`],
  'core:visualizeWorkflow': [`'${WORKFLOW}'`],
  'core:workflowEscapeLabel': ["'Build \"app\" [prod]'"],
  'core:mermaidText': ["'graph LR; A-->B'"],
  'core:renderFlowchart': ["{ direction: 'LR', nodes: [{ id: 'build', lines: ['Build'] }, { id: 'test', lines: ['Test'] }, { id: 'deploy', lines: ['Deploy'] }], edges: [{ from: 'build', to: 'test' }, { from: 'test', to: 'deploy' }] }"],
  'core:mermaidId': ["'order items'"],
  'core:mermaidType': ["'VARCHAR(255)'"],
  'core:uniqueIds': ["['Web App', 'web-app', 'API']", "(s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_')"],
  'core:parseDdl': [`"${DDL}"`],
  'core:ddlToErd': [`"${DDL}"`, "'mermaid'"],
  'core:buildDdlChangeDiagram': ["'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));'", "'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email TEXT);'"],
  'core:composeTextToMermaid': [`'${COMPOSE}'`],
  'core:composeToMermaid': ["{ services: { web: { image: 'nginx:1.27', depends_on: ['api'] }, api: { image: 'node:22-alpine' } } }"],
  'core:asString': ["{ published: 8080, target: 80 }"],
  'core:namedVolumeOf': ["'pgdata:/var/lib/postgresql/data'"],
  'core:portMapping': ["'127.0.0.1:8080:80'"],
  'core:matrixInfo': ["{ node: [20, 22], os: ['ubuntu-latest', 'windows-latest'], exclude: [{ node: 20, os: 'windows-latest' }] }"],
  'core:k8sResources': [`'${K8S}'`],
  'core:k8sToMermaid': [`'${K8S}'`],
  'core:extractMermaidBlocks': ["'# Flow\\n\\n```mermaid\\ngraph LR; A-->B\\n```\\n'"],
  'core:findTemplate': ["'flowchart'"],
  'core:base64UrlEncode': ["new TextEncoder().encode('graph LR; A-->B')"],
  'core:encodeShareFragment': ["'graph LR; A-->B'"],
  'core:detectDiagramType': ["'sequenceDiagram\\n  Alice->>Bob: Hi'"],
  'core:toMarkdownBlock': ["'graph LR; A-->B'"],
  // recipes
  'recipes:getRecipe': ["'decode-base64-json-param'"],
  'recipes:slugifyRecipeName': ["'Decode a JWT, then pretty-print it'"],
  'recipes:recipeExportFileName': [],
  'recipes:recipeDraftErrors': ["'My recipe'", "'Decode then format.'", '1'],
  'recipes:capValue': ["'x'.repeat(10)"],
  'recipes:profileValue': ["'{\"user\":\"ada\",\"role\":\"admin\"}'"],
  'recipes:jsonChanges': ["'{\"a\":1,\"b\":2}'", "'{\"a\":1,\"b\":3,\"c\":4}'"],
  'recipes:lineDiff': ["'one\\ntwo\\nthree'", "'one\\n2\\nthree'"],
  'recipes:describeStep': ["'eyJ1c2VyIjoiYWRhIn0='", "'{\"user\":\"ada\"}'"],
  'recipes:runFileName': ["'Read a Base64 JSON query parameter'"],
  'recipes:readOptions': ["{ variant: 'urlsafe', wrapOutput: true }"],
  'recipes:builtinCategoryCounts': ['BUILTIN_RECIPES'],
  'recipes:runnableRecipes': [],
  // browser
  'browser:generateQrCodeDataUrl': ["'https://smartdevutils.com'"],
  'browser:copyToClipboard': ["'Copied from the playground'"],
  'browser:base64ToBlob': ["'SGVsbG8='", "'text/plain'"],
  'browser:downloadText': ["'Hello from the playground'", "'hello.txt'"],
  'browser:checkHtmlAccessibility': ["'<img src=\"logo.png\"><button></button>'"],
  'browser:getWcagViolations': ["'<img src=\"logo.png\"><button></button>'"],
  'browser:parseUserAgent': ['navigator.userAgent'],
  'browser:detectBrowser': ['navigator.userAgent'],
  'browser:detectOs': ['navigator.userAgent'],
  'browser:renderMermaid': ["'graph LR; Build-->Test-->Deploy'"],
}

/** Extra imports some overrides need (beyond the function itself). */
const EXTRA_IMPORTS = {
  'recipes:builtinCategoryCounts': ['BUILTIN_RECIPES'],
}

function placeholder(param) {
  const n = param.name.toLowerCase()
  const t = param.type.replace(/^readonly\s+/, '')
  if (/^string\b/.test(t) || /^'[^']*'(\s*\|\s*'[^']*')*$/.test(t)) {
    const lit = /^'([^']*)'/.exec(t)
    if (lit) return `'${lit[1]}'`
    if (/json/.test(n)) return `'{"id":1,"name":"Ada"}'`
    if (/csv/.test(n)) return `'id,name\\n1,Ada'`
    if (/sql|ddl/.test(n)) return `'CREATE TABLE users (id INT PRIMARY KEY);'`
    if (/ya?ml/.test(n)) return `'key: value'`
    if (/html/.test(n)) return `'<p>Hello</p>'`
    if (/markdown|md/.test(n)) return `'# Title'`
    if (/id|slug/.test(n)) return `'json-formatter'`
    return `'Hello, SmartDevUtils!'`
  }
  if (/^number\b/.test(t)) return /count|words|length|limit|max/.test(n) ? '3' : '42'
  if (/^boolean\b/.test(t)) return 'true'
  if (/\[\]$|^Array</.test(t)) return `[] /* ${t} */`
  if (/^Record<|^\{/.test(t)) return `{} /* ${t} */`
  return `undefined as any /* ${t} */`
}

/**
 * @param {string} pkgId
 * @param {object} entry raw API entry (kind function)
 * @param {string} moduleName import path
 * @param {{ dom: boolean }} env
 * @returns {{ snippet: object, exact: boolean } | null}
 */
export function generatedFunctionSnippet(pkgId, entry, moduleName, env) {
  const key = `${pkgId}:${entry.name}`
  const override = ARG_OVERRIDES[key]
  let args
  let exact = true
  if (override) {
    args = override
  } else {
    const required = (entry.params ?? []).filter((p) => !p.optional)
    args = required.map(placeholder)
    exact = !args.some((a) => a.includes('/*'))
  }
  const returnsPromise = /^Promise</.test(entry.returns ?? '')
  const returnsVoid = /^(void|Promise<void>)$/.test(entry.returns ?? '')
  const imports = [entry.name, ...(EXTRA_IMPORTS[key] ?? [])]
  const call = `${returnsPromise ? 'await ' : ''}${entry.name}(${args.join(', ')})`
  const lines = [`import { ${imports.join(', ')} } from '${moduleName}'`, '']
  if (returnsVoid) {
    lines.push(call)
    lines.push(`console.log('done')`)
  } else {
    lines.push(`const result = ${call}`)
    lines.push('console.log(result)')
  }
  return {
    exact,
    snippet: {
      id: 'example',
      title: `Call ${entry.name}()`,
      lang: 'ts',
      code: lines.join('\n') + '\n',
      mode: 'run',
      output: 'console',
      description: exact
        ? env.dom
          ? 'Generated example. It needs a browser, so it runs in the preview sandbox only.'
          : 'Generated example with sample arguments.'
        : 'Generated template: replace the placeholder arguments before running.',
      source: 'generated',
    },
  }
}
