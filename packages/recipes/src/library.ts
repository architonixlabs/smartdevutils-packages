import { BuiltinRecipe } from './model';

/**
 * Ready-made recipes shown first in the Recipe Gallery. Loaded as its own chunk (RecipeLibraryService), so it is not in
 * the start-up bundle; the gallery's server render includes it.
 *
 * Every chain was checked against the tools' code, not their names: each step before the last has an output panel
 * (where "Next" lives), each step after the first takes piped input, and the value one step produces is input the next
 * step reads. `modes` opens a step in the mode the chain needs when the tool's default mode is the wrong one.
 *
 * Categories with fewer than three:
 *  - network-tools and developer-reference: every tool in them is an analyzer (it reads input and reports, with no
 *    output to pipe on), so they can only be the last step; two chains each ended in one of them meaningfully.
 *    The two crontab chains read like DevOps work but stay in developer-reference, which would otherwise be empty.
 *  - compare-tools: the compare tools take two inputs, so they are never a pipe source or target (canPipe). Their
 *    recipes prepare one side of a comparison; run them once per side, then paste both into the compare tool.
 *  - planning-tools: only the Changelog Generator has an output panel and reads piped input, so all three start there.
 */
export const BUILTIN_RECIPES: readonly BuiltinRecipe[] = [
  // Encoder / Decoder
  {
    id: 'decode-base64-json-param',
    name: 'Read a Base64 JSON query parameter',
    description: 'Decode a URL-encoded Base64 value from a query string or cookie (OAuth state, tracking blobs) back into readable JSON.',
    category: 'encoder-decoder',
    toolIds: ['url-encoder-decoder', 'base64-encoder-decoder', 'json-formatter'],
    sample: 'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0%3D',
    modes: { 'url-encoder-decoder': 'decode', 'base64-encoder-decoder': 'decode' },
  },
  {
    id: 'inspect-gzipped-payload',
    name: 'Inspect a gzipped Base64 payload',
    description: 'Decompress a gzip or deflate body stored as Base64 (message queues, compressed API fields) and pretty-print the JSON inside.',
    category: 'encoder-decoder',
    toolIds: ['gzip-compressor', 'json-formatter'],
    sample: 'H4sIAAAAAAAACqtWyi9KSS3yTFGyUnLUNTQwMVLSUcosSc0tVrKKrlYqzi5VslIKcXXUNTBU0lEqLKlUsjKq1YFJ+Ia66xqYwyQMa2N1lErySxJzlKyMjPVMawFLdfLeXQAAAA==',
    modes: { 'gzip-compressor': 'decompress' },
  },
  {
    id: 'json-to-base64-env',
    name: 'Pack JSON into one Base64 value',
    description: 'Minify a JSON config and Base64-encode it so it fits in a single environment variable, header or secret. Base64 only packs the value; it does not hide it.',
    category: 'encoder-decoder',
    toolIds: ['json-formatter', 'base64-encoder-decoder'],
    sample: '{\n  "apiUrl": "https://api.example.com",\n  "retries": 3,\n  "features": {\n    "darkMode": true,\n    "beta": false\n  }\n}',
    modes: { 'json-formatter': 'minify', 'base64-encoder-decoder': 'encode' },
  },

  // Formatter / Minifier
  {
    id: 'repair-and-minify-json',
    name: 'Fix almost-JSON, then minify it',
    description: 'Repair JSON with comments, single quotes or trailing commas (from a JS file or an LLM reply) and minify it for a config value or request body.',
    category: 'formatter-minifier',
    toolIds: ['json-repair', 'json-formatter'],
    sample: '{\n  // settings copied from a JS file\n  name: \'demo-app\',\n  port: 8080,\n  tags: [\'web\', \'internal\',],\n  debug: true,\n}',
    modes: { 'json-formatter': 'minify' },
  },
  {
    id: 'build-a-bookmarklet',
    name: 'Build a bookmarklet',
    description: 'Minify a JavaScript snippet wrapped in (()=>{...})() and URL-encode it. The output has no javascript: prefix: add javascript: in front before you save it as a bookmark.',
    category: 'formatter-minifier',
    toolIds: ['js-formatter', 'url-encoder-decoder'],
    sample: '(() => {\n  const title = document.title;\n  const words = document.body.innerText.split(/\\s+/).length;\n  alert(title + \': \' + words + \' words\');\n})();',
    modes: { 'js-formatter': 'minify', 'url-encoder-decoder': 'encode' },
  },
  {
    id: 'sql-to-string-literal',
    name: 'Paste a readable SQL query into code',
    description: 'Format a one-line SQL query, then escape it for a double-quoted string ("...") in JSON, JavaScript, Java or C#: line breaks become \\n and double quotes are escaped, single quotes stay as they are.',
    category: 'formatter-minifier',
    toolIds: ['sql-formatter', 'string-escape-unescape'],
    sample: 'select u.id, u.email, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.status = \'active\' group by u.id, u.email order by orders desc limit 20',
    modes: { 'sql-formatter': 'format', 'string-escape-unescape': 'escape' },
  },

  // Compare / Diff: preparation chains (compare tools are not pipeable; see the note at the top).
  {
    id: 'normalise-list-for-compare',
    name: 'Prepare a list for List Compare (run once per list)',
    description: 'Trim stray spaces and sort a pasted list so List Compare reports only items that really differ. Run the recipe once for each list, then paste both results into List Compare.',
    category: 'compare-tools',
    toolIds: ['text-cleaner', 'line-sorter-deduplicator'],
    sample: '  banana\napple   \n\n   cherry\ndate  \n  apple',
    modes: { 'line-sorter-deduplicator': 'alpha-asc' },
  },
  {
    id: 'yaml-to-json-for-diff',
    name: 'Flatten a YAML config for a diff',
    description: 'Convert a YAML config to JSON and flatten it to one "path": value pair per line, so a diff of two versions in JSON Compare or Text Compare points at the exact keys that changed. Run once per version.',
    category: 'compare-tools',
    toolIds: ['yaml-formatter', 'json-flatten-converter'],
    sample: 'service:\n  name: checkout\n  replicas: 3\n  ports:\n    - 8080\n    - 8443\n  env:\n    LOG_LEVEL: info\n    REGION: eu-west-1\n',
    modes: { 'yaml-formatter': 'yaml-to-json', 'json-flatten-converter': 'flatten' },
  },
  {
    id: 'page-text-for-diff',
    name: 'Get a page\'s text ready for Text Compare',
    description: 'Convert a page\'s HTML to Markdown and tidy the spacing, so Text Compare shows wording changes instead of tag noise. Run once per page version.',
    category: 'compare-tools',
    toolIds: ['html-markdown-converter', 'text-cleaner'],
    sample: '<article>\n  <h1>Pricing</h1>\n  <p>Our <strong>Starter</strong> plan costs <em>$9 per month</em> and includes 3 projects.</p>\n  <ul>\n    <li>Email support</li>\n    <li>Daily backups</li>\n  </ul>\n</article>',
    modes: { 'html-markdown-converter': 'html-to-md' },
  },

  // Text
  {
    id: 'unique-emails-from-text',
    name: 'Collect unique email addresses',
    description: 'Pull every email address out of a thread or export, lower-case them and drop duplicates for a clean mailing list.',
    category: 'text-tools',
    toolIds: ['text-extractor', 'text-case-converter', 'line-sorter-deduplicator'],
    sample: 'Hi team, please loop in Ada.Lovelace@Example.com and grace@example.org.\nAlso cc ada.lovelace@example.com, ALAN@example.net and grace@example.org on the follow-up.',
    modes: { 'text-extractor': 'emails', 'text-case-converter': 'lowercase', 'line-sorter-deduplicator': 'dedupe' },
  },
  {
    id: 'spreadsheet-to-markdown-table',
    name: 'Spreadsheet range to a README table',
    description: 'Turn cells copied from Excel or a CSV into a Markdown table and preview how it renders before you commit it.',
    category: 'text-tools',
    toolIds: ['csv-markdown-table', 'markdown-preview'],
    sample: 'Name,Role,Location\nAda,Engineer,London\nGrace,Admiral,New York\nAlan,Researcher,Manchester',
    modes: { 'csv-markdown-table': 'csv-to-md', 'markdown-preview': 'preview' },
  },
  {
    id: 'clean-text-word-frequency',
    name: 'Find the most-used words',
    description: 'Tidy text pasted from a PDF or web page, then rank its words to spot repetition or check keyword use.',
    category: 'text-tools',
    toolIds: ['text-cleaner', 'word-frequency'],
    sample: '  The   quick brown fox   jumps over the lazy dog.\n\n\nThe dog   sleeps, and   the fox runs   away.   \n   The end.  ',
  },

  // Security & Hashing
  {
    id: 'redact-then-scan-secrets',
    name: 'Redact a log and double-check it',
    description: 'Mask emails, IPs, tokens and keys in a log, then scan the result to make sure no credential slipped through before you share it.',
    category: 'security-tools',
    toolIds: ['log-redactor', 'secret-scanner'],
    sample: '2026-03-14T10:15:30Z INFO login ok user=ada@example.com ip=203.0.113.42\n2026-03-14T10:15:31Z WARN retry token=Bearer abc.def.ghi password=example-password-123\n2026-03-14T10:15:32Z INFO card=4111 1111 1111 1111 checkout complete',
  },
  {
    id: 'generate-and-rate-password',
    name: 'Generate a passphrase and rate it',
    description: 'Generate a random passphrase (the sample 7 is the number of words) and rate it. The generator shows the word-list entropy, which is the real figure; the strength check estimates from length and character types, so its number is higher.',
    category: 'security-tools',
    toolIds: ['passphrase-generator', 'password-strength'],
    sample: '7',
  },
  {
    id: 'sign-and-verify-jwt',
    name: 'Sign a test JWT and inspect it',
    description: 'Build and sign a test JWT with a demo secret (never a production key), then decode it to read the header, claims and expiry. Decoding does not check the signature: paste the same secret into Verify signature for that.',
    category: 'security-tools',
    toolIds: ['jwt-builder', 'jwt-decoder'],
    sample: '{\n  "sub": "user-1042",\n  "name": "Ada Example",\n  "role": "admin",\n  "iat": 1767225600,\n  "exp": 1893456000\n}',
  },

  {
    id: 'defang-report-links',
    name: 'Defang the links in an incident note',
    description: 'Pull every URL out of an incident note or alert and defang each one (hxxp, [.]) so the list can go into a ticket or chat without turning into clickable links.',
    category: 'security-tools',
    toolIds: ['text-extractor', 'ioc-defang-refang'],
    sample: 'Alert 7731: user reported a phishing email. The button linked to http://login.example.com.account-verify.test/session and the page loaded https://cdn.example.net/kit/collect.js. Exfiltration went to https://203.0.113.42:8443/upload. The real sign-in page is https://login.example.com/.',
    modes: { 'text-extractor': 'urls', 'ioc-defang-refang': 'defang' },
  },

  // Date & Time
  {
    id: 'convert-log-epochs',
    name: 'Convert every epoch in a log',
    description: 'Pull the numbers out of a log excerpt or payload and convert each Unix timestamp (seconds or milliseconds) to a UTC and local date in one pass. Every number is converted, so ignore rows for ids, counts or ports.',
    category: 'date-time-tools',
    toolIds: ['text-extractor', 'epoch-converter'],
    sample: '{"event":"order.created","createdAt":1767225600,"updatedAt":1767312000000}',
    modes: { 'text-extractor': 'numbers', 'epoch-converter': 'bulk' },
  },
  {
    id: 'dates-to-epochs',
    name: 'Turn the dates in a text into epochs',
    description: 'Extract every ISO date and date-time from a document and get the Unix seconds for each, for a query or fixture.',
    category: 'date-time-tools',
    toolIds: ['text-extractor', 'epoch-converter'],
    sample: 'Release 2.0 shipped on 2026-01-15, the hotfix on 2026-02-03T09:30:00Z and the review is set for 2026-03-01T14:00:00+01:00.',
    modes: { 'text-extractor': 'dates', 'epoch-converter': 'bulk' },
  },
  {
    id: 'sort-dates-chronologically',
    name: 'List a log\'s timestamps in order',
    description: 'Extract the ISO timestamps from a log or report and sort them; only the timestamps are returned, not the log lines. For same-format UTC times the sort is chronological order.',
    category: 'date-time-tools',
    toolIds: ['text-extractor', 'line-sorter-deduplicator'],
    sample: '2026-03-14T10:15:32Z ERROR payment failed\n2026-03-14T09:02:11Z INFO service started\n2026-03-14T10:01:45Z WARN slow query\n2026-03-13T23:59:59Z INFO nightly backup done',
    modes: { 'text-extractor': 'dates', 'line-sorter-deduplicator': 'alpha-asc' },
  },

  // CSS & Color
  {
    id: 'tailwind-to-inline-style',
    name: 'Tailwind classes to an inline style',
    description: 'Translate Tailwind utility classes into plain CSS declarations and minify them into one line for a style attribute or an email template. Theme colours such as bg-blue-500 have no fixed value and are left out, so add them by hand.',
    category: 'css-tools',
    toolIds: ['tailwind-converter', 'css-formatter'],
    sample: 'flex items-center justify-between gap-4 p-6 rounded-lg bg-white shadow-md text-sm font-semibold',
    modes: { 'css-formatter': 'minify' },
  },
  {
    id: 'critical-css-size',
    name: 'Check the real size of critical CSS',
    description: 'Minify a stylesheet and gzip it: the line under the gzip output gives the original and compressed byte counts, the size that goes over the wire, for inline or critical-CSS budgets. The output itself is the compressed data, written as text.',
    category: 'css-tools',
    toolIds: ['css-formatter', 'gzip-compressor'],
    sample: 'header {\n  display: flex;\n  align-items: center;\n  padding: 16px 24px;\n  background: #ffffff;\n}\n\n.hero h1 {\n  font-size: 2.5rem;\n  line-height: 1.2;\n  margin: 0 0 16px;\n}\n\n.btn-primary {\n  background: #4f46e5;\n  color: #ffffff;\n  border-radius: 8px;\n  padding: 10px 20px;\n}\n',
    modes: { 'css-formatter': 'minify', 'gzip-compressor': 'compress' },
  },
  {
    id: 'audit-css-tokens',
    name: 'List the CSS variables in a stylesheet',
    description: 'Beautify a minified vendor or theme stylesheet and list every CSS custom property it defines, grouped by selector, with its value.',
    category: 'css-tools',
    toolIds: ['css-formatter', 'css-variables'],
    sample: ':root{--brand:#4f46e5;--brand-dark:#3730a3;--radius:8px;--space-md:16px}.btn{background:var(--brand);border-radius:var(--radius);padding:var(--space-md)}.btn:hover{background:var(--brand-dark)}',
    modes: { 'css-formatter': 'format', 'css-variables': 'extract' },
  },
  {
    id: 'stylesheet-colour-list',
    name: 'List the distinct colours in a stylesheet',
    description: 'Pull every hex colour (#fff, #4f46e5) out of a stylesheet, lower-case them and drop repeats, to see how many colours a theme really uses before you turn them into tokens. rgb() and hsl() values are not picked up.',
    category: 'css-tools',
    toolIds: ['text-extractor', 'text-case-converter', 'line-sorter-deduplicator'],
    sample: '.btn { background: #4F46E5; color: #FFFFFF; }\n.btn:hover { background: #4338CA; }\n.link { color: #4f46e5; }\n.card { background: #ffffff; border: 1px solid #E5E7EB; }\n.alert { color: #DC2626; background: #FEF2F2; }',
    modes: { 'text-extractor': 'colors', 'text-case-converter': 'lowercase', 'line-sorter-deduplicator': 'dedupe' },
  },

  // Developer Utilities
  {
    id: 'curl-to-fetch',
    name: 'Turn a cURL command into fetch()',
    description: 'Build or paste a curl request from API docs and convert it into a JavaScript fetch() call for your front end.',
    category: 'developer-tools',
    toolIds: ['curl-builder', 'curl-fetch-converter'],
    sample: 'curl -X POST https://api.example.com/v1/orders -H \'Content-Type: application/json\' -H \'Accept: application/json\' -d \'{"sku":"TEA-01","qty":2}\'',
    modes: { 'curl-builder': 'build' },
  },
  {
    id: 'unescape-json-from-log',
    name: 'Read JSON escaped inside a log line',
    description: 'Unescape a JSON document that was logged as a string (full of \\" and \\n) and pretty-print it.',
    category: 'developer-tools',
    toolIds: ['string-escape-unescape', 'json-formatter'],
    sample: '{\\"event\\":\\"login\\",\\"user\\":\\"ada\\",\\"ok\\":true,\\"roles\\":[\\"admin\\",\\"dev\\"]}',
    modes: { 'string-escape-unescape': 'unescape', 'json-formatter': 'format' },
  },
  {
    id: 'decode-and-parse-url',
    name: 'Break down an encoded redirect URL',
    description: 'Percent-decode a redirect or callback URL, then split it into host, path and query parameters to see where it really goes.',
    category: 'developer-tools',
    toolIds: ['url-encoder-decoder', 'url-parser'],
    sample: 'https%3A%2F%2Fapp.example.com%2Foauth%2Fcallback%3Fcode%3Dabc123%26state%3Dxyz789%26next%3D%2Fdashboard',
    modes: { 'url-encoder-decoder': 'decode' },
  },
  {
    id: 'explain-regex-from-code',
    name: 'Explain a regex copied from a code string',
    description: 'Unescape a regular expression copied from a JSON, Java or C# string (where every backslash is doubled) and get a token-by-token explanation of the real pattern.',
    category: 'developer-tools',
    toolIds: ['string-escape-unescape', 'regex-explainer'],
    sample: '^(\\\\d{4})-(\\\\d{2})-(\\\\d{2})T(\\\\d{2}):(\\\\d{2})(?::(\\\\d{2}))?Z$',
    modes: { 'string-escape-unescape': 'unescape' },
  },

  // Data Format
  {
    id: 'ndjson-to-csv-profile',
    name: 'Check a JSON Lines (NDJSON) export as a table',
    description: 'Turn an NDJSON log or export into a JSON array, convert it to CSV and check row counts, column types and empty cells.',
    category: 'data-tools',
    toolIds: ['ndjson-formatter', 'json-csv-converter', 'csv-inspector'],
    sample: '{"id":1,"name":"Ada","plan":"pro","seats":5}\n{"id":2,"name":"Grace","plan":"starter","seats":1}\n{"id":3,"name":"Alan","plan":"pro","seats":12}',
    modes: { 'ndjson-formatter': 'to-array', 'json-csv-converter': 'json-to-csv', 'csv-inspector': 'inspect' },
  },
  {
    id: 'query-yaml-with-jq',
    name: 'Query a YAML file with jq',
    description: 'Convert a YAML config, Compose file or manifest to JSON and pull out the values you need with a jq filter; the sample filter lists each Compose service with its image.',
    category: 'data-tools',
    toolIds: ['yaml-formatter', 'jq-playground'],
    sample: 'services:\n  web:\n    image: nginx:1.27\n    ports:\n      - "8080:80"\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_DB: app\n',
    modes: { 'yaml-formatter': 'yaml-to-json' },
    options: { 'jq-playground': { filter: '.services | to_entries | map({service: .key, image: .value.image})' } },
  },
  {
    id: 'query-csv-with-jsonpath',
    name: 'Query a spreadsheet with JSONPath',
    description: 'Convert a CSV export to JSON and filter its rows with a JSONPath expression instead of spreadsheet formulas. CSV values come out as strings ("5", not 5), so compare numbers as text.',
    category: 'data-tools',
    toolIds: ['json-csv-converter', 'jsonpath-tester'],
    sample: 'id,name,plan,seats\n1,Ada,pro,5\n2,Grace,starter,1\n3,Alan,pro,12',
    modes: { 'json-csv-converter': 'csv-to-json' },
    // JSONPath needs an expression as well as the data: list the names on the pro plan.
    options: { 'jsonpath-tester': { expression: "$[?(@.plan == 'pro')].name" } },
  },

  // Developer Reference (analyzers only; see the note at the top)
  {
    id: 'cronjob-json-schedules',
    name: 'Explain CronJob schedules from kubectl JSON',
    description: 'Convert the List from kubectl get cronjobs -o json to YAML, then see every CronJob\'s schedule with its next runs and collisions. A CronJob without spec.timeZone is read in UTC, the zone the controller normally uses.',
    category: 'developer-reference',
    toolIds: ['yaml-formatter', 'crontab-calculator'],
    sample: '{"apiVersion":"v1","items":[{"apiVersion":"batch/v1","kind":"CronJob","metadata":{"name":"nightly-report","namespace":"demo"},"spec":{"schedule":"30 2 * * *","jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"report","image":"example/report:1.4"}],"restartPolicy":"OnFailure"}}}}}},{"apiVersion":"batch/v1","kind":"CronJob","metadata":{"name":"cache-warmup","namespace":"demo"},"spec":{"schedule":"30 2 * * *","timeZone":"Europe/London","jobTemplate":{"spec":{"template":{"spec":{"containers":[{"name":"warmup","image":"example/warmup:2.0"}],"restartPolicy":"OnFailure"}}}}}}],"kind":"List","metadata":{"resourceVersion":""}}',
    modes: { 'yaml-formatter': 'json-to-yaml', 'crontab-calculator': 'multi' },
  },
  {
    id: 'merged-crontab-collisions',
    name: 'Find collisions across merged crontabs',
    description: 'Drop identical lines from crontabs gathered from several servers, then see which jobs run at the same minute.',
    category: 'developer-reference',
    toolIds: ['line-sorter-deduplicator', 'crontab-calculator'],
    sample: '0 2 * * * /opt/backup/run.sh\n*/15 * * * * /opt/app/sync.sh\n0 2 * * * /opt/backup/run.sh\n0 2 * * * /opt/reports/nightly.sh\n*/15 * * * * /opt/app/sync.sh',
    modes: { 'line-sorter-deduplicator': 'dedupe', 'crontab-calculator': 'multi' },
  },

  // Network (analyzers only; see the note at the top)
  {
    id: 'inspect-defanged-ip',
    name: 'Inspect a defanged IP from a report',
    description: 'Refang an address written as 10[.]0[.]0[.]1 in a threat report, then see its type, range and whether it is private.',
    category: 'network-tools',
    toolIds: ['ioc-defang-refang', 'ip-inspector'],
    sample: '203.0.113[.]42',
    modes: { 'ioc-defang-refang': 'refang' },
  },
  {
    id: 'unique-ips-from-log',
    name: 'List the unique client IPs in a log',
    description: 'Extract every IPv4 address from an access log or firewall export and drop repeats to see who connected.',
    category: 'network-tools',
    toolIds: ['text-extractor', 'line-sorter-deduplicator'],
    sample: '203.0.113.42 - - [14/Mar/2026:10:15:30 +0000] "GET / HTTP/1.1" 200 512\n198.51.100.7 - - [14/Mar/2026:10:15:31 +0000] "GET /login HTTP/1.1" 200 1024\n203.0.113.42 - - [14/Mar/2026:10:15:35 +0000] "POST /login HTTP/1.1" 302 0\n192.0.2.15 - - [14/Mar/2026:10:16:02 +0000] "GET /admin HTTP/1.1" 403 128',
    modes: { 'text-extractor': 'ipv4', 'line-sorter-deduplicator': 'dedupe' },
  },

  // Accessibility & WCAG
  {
    id: 'markdown-docs-a11y',
    name: 'Check Markdown docs for accessibility',
    description: 'Render Markdown docs to HTML and audit the result for skipped heading levels and link text such as "click here". An image written as ![](...) gets alt="", which counts as decorative and is not flagged, so describe real images inside the brackets.',
    category: 'accessibility-tools',
    toolIds: ['markdown-preview', 'html-accessibility'],
    sample: '# Getting started\n\n### Install\n\nRun the installer, then open the dashboard.\n\n![](https://example.com/images/dashboard.png)\n\n[click here](https://example.com/docs) to read more.',
    modes: { 'markdown-preview': 'html' },
  },
  {
    id: 'web-page-reading-level',
    name: 'Score the reading level of a web page',
    description: 'Convert a page\'s HTML to Markdown so the tags drop out, then measure its reading grade against WCAG 3.1.5.',
    category: 'accessibility-tools',
    toolIds: ['html-markdown-converter', 'readability-checker'],
    sample: '<article><h1>Resetting your password</h1><p>If you forget your password, open the sign-in page and choose Forgot password. We will email you a link. Click the link and pick a new password. The link works for one hour.</p><p>Notwithstanding the aforementioned procedure, administrators may, at their discretion, initiate a mandatory credential rotation for compliance purposes.</p></article>',
    modes: { 'html-markdown-converter': 'html-to-md' },
  },
  {
    id: 'audit-minified-html',
    name: 'Audit minified production HTML',
    description: 'Beautify minified HTML so it is readable, then run a static accessibility analysis over it.',
    category: 'accessibility-tools',
    toolIds: ['html-formatter', 'html-accessibility'],
    sample: '<!DOCTYPE html><html><head><title>Shop</title></head><body><div class="nav"><a href="/"><img src="/logo.png"></a></div><h1>Welcome</h1><h3>Deals</h3><form><input type="email" placeholder="Email"><button></button></form></body></html>',
    modes: { 'html-formatter': 'format' },
  },

  // Database
  {
    id: 'seed-rows-as-sql',
    name: 'Generate seed rows as SQL',
    description: 'Generate fake rows (5 with the sample; change Row count for more) as INSERT statements and format them for review before loading a dev database. Emails use the reserved example.com, .net and .org domains.',
    category: 'database-tools',
    toolIds: ['data-faker', 'sql-formatter'],
    sample: '5',
    modes: { 'data-faker': 'sql', 'sql-formatter': 'format' },
  },
  {
    id: 'csv-to-upsert',
    name: 'Turn a CSV into a reviewed UPSERT',
    description: 'Turn a CSV export into a PostgreSQL UPSERT (INSERT ... ON CONFLICT DO UPDATE: new ids are inserted, existing ones updated, so it is safe to run again) and format it for code review.',
    category: 'database-tools',
    toolIds: ['sql-insert-generator', 'sql-formatter'],
    sample: 'id,email,plan\n1,ada@example.com,pro\n2,grace@example.com,starter\n3,alan@example.com,pro',
    modes: { 'sql-insert-generator': 'upsert', 'sql-formatter': 'format' },
    // The generic SQL formatter splits ON CONFLICT ... DO UPDATE across lines; the PostgreSQL dialect keeps it whole.
    options: { 'sql-formatter': { dialect: 'postgresql' } },
  },
  {
    id: 'schema-dump-to-erd',
    name: 'Diagram a schema dump',
    description: 'Tidy CREATE TABLE statements from a schema dump and turn them into a Mermaid ER diagram for your docs.',
    category: 'database-tools',
    toolIds: ['sql-formatter', 'ddl-to-erd'],
    sample: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, created_at TIMESTAMP NOT NULL); CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), total NUMERIC(10,2) NOT NULL);',
    modes: { 'sql-formatter': 'format', 'ddl-to-erd': 'mermaid' },
  },

  // AI / ML
  {
    id: 'redact-then-chunk',
    name: 'Redact logs before embedding them',
    description: 'Mask emails, phone numbers, IPs, card numbers and secrets in logs or tickets, then split them into chunks for a RAG index. Pattern matching misses names and free-text details, so read the chunks before indexing.',
    category: 'ai-ml-tools',
    toolIds: ['log-redactor', 'text-chunker'],
    sample: 'Ticket 4821: customer ada@example.com (phone +44 20 7946 0958) reports checkout failing from 203.0.113.42. Steps: added two items, applied code SPRING10, paid by card ending 1111. The page showed error 502 after 30 seconds.\n\nSecond attempt from 198.51.100.7 worked, but the card was charged twice. Customer asks for a refund of the duplicate charge and a call back on +1 (555) 010-1234.\n\nAgent note: payment gateway logs show two captures 4 seconds apart for order A-1042. Retry logic in the checkout service sent the capture again after the 502. Refund approved; engineering ticket opened to make the capture request idempotent. Follow-up email sent to grace@example.org in billing.',
  },
  {
    id: 'web-page-to-chunks',
    name: 'Turn a web page into RAG chunks',
    description: 'Convert a page\'s HTML to Markdown and split it by headings, so each chunk keeps its section context.',
    category: 'ai-ml-tools',
    toolIds: ['html-markdown-converter', 'text-chunker'],
    sample: '<h1>Deploy guide</h1><p>This guide covers deploying the app to production.</p><h2>Build</h2><p>Run the build command and check the output folder.</p><h2>Configure</h2><p>Set the environment variables for the database and the mail gateway.</p><h2>Release</h2><p>Tag the commit and push the tag to trigger the pipeline.</p>',
    modes: { 'html-markdown-converter': 'html-to-md', 'text-chunker': 'markdown' },
  },
  {
    id: 'clean-then-chunk',
    name: 'Clean pasted text before chunking',
    description: 'Strip the extra spaces and blank lines that PDF and web copies carry, then chunk the text for embeddings.',
    category: 'ai-ml-tools',
    toolIds: ['text-cleaner', 'text-chunker'],
    sample: '   Retrieval augmented generation   combines a search step   with a language model.\n\n\nFirst,   documents are split into chunks   and embedded.   Each chunk becomes a vector   that captures   what the text is about,   and the vectors are stored   in an index.\n\n\n\nAt query time,   the question is embedded   the same way,   the closest chunks are retrieved   and passed to the model as context.   The model then answers   from that context   instead of from memory alone.\n\n   Chunk size matters.   Chunks that are too small   lose the surrounding meaning,   while chunks that are too large   mix several topics   and waste the context window.   A small overlap between chunks   keeps sentences that cross a boundary   readable in both.   \n\n\nFinally,   test the index with real questions   and check that the right chunks come back   before you build on it.   ',
  },

  // Planning & Analysis (only the Changelog Generator can start a chain; see the note at the top)
  {
    id: 'preview-changelog',
    name: 'Write and preview a changelog section',
    description: 'Turn git log output with Conventional Commits into a Keep a Changelog section and preview it as rendered Markdown. A breaking change (feat!) is listed under Breaking changes and again under its type.',
    category: 'planning-tools',
    toolIds: ['changelog-generator', 'markdown-preview'],
    sample: 'a1b2c3d feat(auth): add passkey sign-in\ne4f5a6b fix(cart): keep quantities after refresh\nc7d8e9f docs: explain the release process\nb0a1c2d feat(api)!: drop the v1 orders endpoint\nd3e4f5a perf(search): cache popular queries',
    modes: { 'changelog-generator': 'changelog', 'markdown-preview': 'preview' },
  },
  {
    id: 'release-notes-readability',
    name: 'Release notes people can read',
    description: 'Generate user-facing release notes from git log and check their reading level before you publish them. The formulas need about 100 words, so use a release with a dozen or more commits.',
    category: 'planning-tools',
    toolIds: ['changelog-generator', 'readability-checker'],
    sample: 'a1b2c3d feat(auth): sign in with a passkey instead of a password\ne4f5a6b fix(cart): keep the items in your cart after you refresh the page\nb0a1c2d feat(export): download any invoice as a PDF from the billing page\nd3e4f5a perf(search): show results for popular searches much faster\nf6a7b8c feat(profile): choose a photo for your profile from your device\nc9d0e1f fix(email): send the receipt email only once for each order\na2b3c4d feat(orders): see the delivery date for each order in the list\ne5f6a7b fix(login): stop asking for the code again after a good sign-in\nb8c9d0e feat(settings): turn off the weekly summary email in one click\nd1e2f3a fix(mobile): make the menu button easier to tap on small screens\nf4a5b6c feat(help): open the help centre from any page with the question mark\nc7d8e9f fix(prices): show prices in the right currency for your country\na0b1c2d feat(teams): invite a team member by email from the people page\ne3f4a5b fix(upload): explain why a file is too big before the upload starts',
    modes: { 'changelog-generator': 'release-notes' },
  },
  {
    id: 'release-notes-html',
    name: 'Release notes as an HTML snippet',
    description: 'Generate release notes from git log, convert the Markdown to HTML and format it for a website or email. Apostrophes come out as &#39;, which browsers and mail clients show as \'.',
    category: 'planning-tools',
    toolIds: ['changelog-generator', 'html-markdown-converter', 'html-formatter'],
    sample: 'a1b2c3d feat(auth): add passkey sign-in\ne4f5a6b fix(cart): keep quantities after refresh\nb0a1c2d feat(export): download invoices as PDF',
    modes: { 'changelog-generator': 'release-notes', 'html-markdown-converter': 'md-to-html', 'html-formatter': 'format' },
  },

  // DevOps & Infrastructure
  {
    id: 'docker-run-to-validated-compose',
    name: 'docker run to a checked Compose file',
    description: 'Convert a docker run command into a Compose service and validate it for missing images, bad ports and depends_on mistakes.',
    category: 'devops-tools',
    toolIds: ['docker-run-to-compose', 'docker-compose-validator'],
    sample: 'docker run -d --name web -p 8080:80 -e APP_ENV=production -v ./site:/usr/share/nginx/html:ro --restart unless-stopped nginx:1.27',
    modes: { 'docker-run-to-compose': 'run-to-compose' },
  },
  {
    id: 'nginx-generate-and-lint',
    name: 'Generate and lint an nginx server block',
    description: 'Generate a server block for your domains (the defaults give an HTTPS reverse proxy), then re-indent it and lint it for unbalanced braces, server blocks without access_log and catch-all server_name _.',
    category: 'devops-tools',
    toolIds: ['nginx-config-generator', 'nginx-formatter'],
    sample: 'example.com www.example.com',
  },
  {
    id: 'env-to-k8s-secret',
    name: 'Turn a .env file into a Kubernetes Secret',
    description: 'Normalise a .env file (drops export, keeps inline comments out of values, keeps the last of a duplicate key) and convert it into a Kubernetes Secret manifest. Secret values are Base64-encoded, not encrypted.',
    category: 'devops-tools',
    toolIds: ['env-parser', 'k8s-secret-codec'],
    sample: '# app settings\nexport DB_HOST=db.example.internal\nDB_USER=app\nDB_PASSWORD="demo-password"\nLOG_LEVEL=info  # dev only\nAPI_URL=https://api.example.com\nDB_USER=app_rw\n',
    modes: { 'env-parser': 'format', 'k8s-secret-codec': 'from-env' },
  },
  {
    id: 'lint-deployment-json',
    name: 'Lint a Deployment from kubectl JSON',
    description: 'Convert a Deployment from kubectl get -o json to YAML and run the Kubernetes manifest checks on it: required fields, an image on :latest, and missing resource limits, probes or securityContext.',
    category: 'devops-tools',
    toolIds: ['yaml-formatter', 'k8s-yaml-validator'],
    sample: '{"apiVersion":"apps/v1","kind":"Deployment","metadata":{"name":"web","namespace":"demo","labels":{"app":"web"}},"spec":{"replicas":2,"selector":{"matchLabels":{"app":"web"}},"template":{"metadata":{"labels":{"app":"web"}},"spec":{"containers":[{"name":"web","image":"example/web:latest","ports":[{"containerPort":8080}]}]}}}}',
    modes: { 'yaml-formatter': 'json-to-yaml' },
  },
  {
    id: 'docker-run-images-pinned',
    name: 'Check docker run images are pinned',
    description: 'Turn one or more docker run commands into a Compose file and check every image: an untagged or :latest image is flagged, a version tag is fine and a @sha256 digest pins it exactly.',
    category: 'devops-tools',
    toolIds: ['docker-run-to-compose', 'docker-tag-checker'],
    sample: 'docker run -d --name web -p 8080:80 nginx:1.27\ndocker run -d --name cache redis\ndocker run -d --name worker -e QUEUE=jobs example/worker:latest',
    modes: { 'docker-run-to-compose': 'run-to-compose' },
  },

  // Everyday
  {
    id: 'check-links-in-message',
    name: 'Check every link in a message',
    description: 'Pull the links out of a long email, chat or newsletter and check each one for warning signs such as a familiar site name used as a prefix of another site, well-known brands spelled with look-alike letters and unencrypted http.',
    category: 'everyday-tools',
    toolIds: ['text-extractor', 'link-safety-checker'],
    sample: 'Your parcel is waiting! Track it at https://example.com/track?id=4821 or confirm your address at http://example.com.parcel-confirm.test/confirm. Questions? Visit https://support.example.com.',
    modes: { 'text-extractor': 'urls' },
  },
  {
    id: 'listen-to-pasted-text',
    name: 'Listen to text copied from a PDF',
    description: 'Remove the broken spacing and blank lines a PDF copy leaves behind, then have the text read aloud.',
    category: 'everyday-tools',
    toolIds: ['text-cleaner', 'read-aloud'],
    sample: 'Welcome   to the quarterly update.\n\n\nSales grew   by twelve percent,   and the new   office opens in May.   \n\nThank you   for your hard work.  ',
  },
  {
    id: 'check-defanged-link',
    name: 'Check a defanged link safely',
    description: 'Turn a link your IT team wrote as hxxp://example[.]com back into a normal address and check it for warning signs without opening it.',
    category: 'everyday-tools',
    toolIds: ['ioc-defang-refang', 'link-safety-checker'],
    sample: 'hxxps://login.example.com.account-reset[.]test/reset?account=4821',
    modes: { 'ioc-defang-refang': 'refang' },
  },
  {
    id: 'unwrap-and-check-link',
    name: 'Unwrap a Safe Links or tracking URL and check it',
    description: 'Read the real destination out of a Microsoft Safe Links, Proofpoint or Google redirect link without opening it, then check that destination for warning signs.',
    category: 'everyday-tools',
    toolIds: ['ioc-defang-refang', 'link-safety-checker'],
    sample: 'https://eur01.safelinks.protection.outlook.com/?url=http%3A%2F%2Fexample.com.parcel-confirm.test%2Fconfirm%3Fid%3D4821&data=05%7C02%7Cdemo%40example.com%7C0000&reserved=0',
    modes: { 'ioc-defang-refang': 'unwrap' },
  },
];
