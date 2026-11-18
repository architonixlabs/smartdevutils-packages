// Pure helpers for the Mermaid Live Editor: starter templates, share links in the URL fragment, diagram type detection.

export interface MermaidTemplate {
  id: string;
  label: string;
  source: string;
}

/**
 * One short starter per diagram type. Every source was drawn with Mermaid 12.2 in Edge before it was added. The
 * xychart, sankey and treemap starters keep the "-beta" keyword: 12.2 accepts both forms, and older renderers
 * (GitHub, GitLab) accept only the "-beta" one. Radar needs "-beta" in 12.2.
 */
export const MERMAID_TEMPLATES: readonly MermaidTemplate[] = [
  {
    id: 'flowchart', label: 'Flowchart',
    source: `flowchart LR
  A[Request] --> B{In cache?}
  B -- Yes --> C[Return cached copy]
  B -- No --> D[Query database]
  D --> E[Store in cache]
  E --> C`,
  },
  {
    id: 'sequence', label: 'Sequence diagram',
    source: `sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API
  participant D as Database
  B->>A: POST /login
  A->>D: Look up user
  D-->>A: User row
  alt Password matches
    A-->>B: 200 OK with token
  else Wrong password
    A-->>B: 401 Unauthorized
  end`,
  },
  {
    id: 'class', label: 'Class diagram',
    source: `classDiagram
  class Customer {
    +String email
  }
  class Order {
    +String id
    +Date placedAt
    +total() Decimal
  }
  class LineItem {
    +String sku
    +int quantity
  }
  Customer "1" --> "*" Order : places
  Order "1" *-- "1..*" LineItem : contains`,
  },
  {
    id: 'state', label: 'State diagram',
    source: `stateDiagram-v2
  [*] --> Draft
  Draft --> Review : submit
  Review --> Draft : request changes
  Review --> Published : approve
  Published --> Archived : archive
  Archived --> [*]`,
  },
  {
    id: 'er', label: 'Entity relationship (ER)',
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "appears in"
  CUSTOMER {
    int id PK
    string email UK
  }
  ORDER {
    int id PK
    int customer_id FK
    date placed_at
  }`,
  },
  {
    id: 'gantt', label: 'Gantt chart',
    source: `gantt
  title Release 2.0
  dateFormat YYYY-MM-DD
  section Build
    Design         :done, des, 2026-01-05, 5d
    Implementation :active, impl, after des, 10d
  section Ship
    Testing        :test, after impl, 5d
    Release        :milestone, after test, 0d`,
  },
  {
    id: 'pie', label: 'Pie chart',
    source: `pie showData
  title Support tickets by channel
  "Email" : 42
  "Chat" : 31
  "Phone" : 17
  "Forum" : 10`,
  },
  {
    id: 'xychart', label: 'XY chart (bar and line)',
    source: `xychart-beta
  title "Monthly signups"
  x-axis [Jan, Feb, Mar, Apr, May, Jun]
  y-axis "Signups" 0 --> 500
  bar [120, 180, 240, 310, 280, 420]
  line [100, 160, 220, 290, 300, 380]`,
  },
  {
    id: 'sankey', label: 'Sankey diagram',
    source: `sankey-beta

Visitors,Signed up,400
Visitors,Left,600
Signed up,Trial,300
Signed up,Inactive,100
Trial,Paid,120
Trial,Churned,180`,
  },
  {
    id: 'quadrant', label: 'Quadrant chart',
    source: `quadrantChart
  title Feature priority
  x-axis Low effort --> High effort
  y-axis Low value --> High value
  quadrant-1 Plan carefully
  quadrant-2 Do first
  quadrant-3 Fill-ins
  quadrant-4 Skip
  Search: [0.3, 0.8]
  Dark mode: [0.2, 0.35]
  Offline sync: [0.8, 0.7]
  Custom themes: [0.7, 0.2]`,
  },
  {
    id: 'mindmap', label: 'Mind map',
    source: `mindmap
  root((Launch plan))
    Product
      Pricing page
      Docs
    Marketing
      Blog post
      Newsletter
    Support
      FAQ`,
  },
  {
    id: 'timeline', label: 'Timeline',
    source: `timeline
  title Project history
  2023 : Idea : First prototype
  2024 : Public beta
  2025 : Version 1.0 : Mobile app
  2026 : Team plan`,
  },
  {
    id: 'gitgraph', label: 'Git graph',
    source: `gitGraph
  commit id: "init"
  branch feature
  checkout feature
  commit id: "add form"
  commit id: "validate"
  checkout main
  commit id: "fix typo"
  merge feature
  commit id: "release" tag: "v1.0"`,
  },
  {
    id: 'journey', label: 'User journey',
    source: `journey
  title Checkout
  section Browse
    Find product: 5: Shopper
    Read reviews: 4: Shopper
  section Pay
    Enter card: 2: Shopper
    Confirm order: 4: Shopper, Store`,
  },
  {
    id: 'radar', label: 'Radar chart',
    source: `radar-beta
  title Team skills
  axis design["Design"], code["Code"], test["Testing"], ops["Ops"], docs["Docs"]
  curve a["Team A"]{4, 5, 3, 2, 4}
  curve b["Team B"]{3, 3, 5, 4, 2}
  max 5
  min 0`,
  },
  {
    id: 'treemap', label: 'Treemap',
    source: `treemap-beta
"Cloud costs"
    "Compute"
        "API servers": 420
        "Workers": 180
    "Storage"
        "Object storage": 120
        "Backups": 60
    "Network": 90`,
  },
];

export function findTemplate(id: string): MermaidTemplate | undefined {
  return MERMAID_TEMPLATES.find(t => t.id === id);
}

/** Longest source a share link carries. */
export const MAX_SHARE_CHARS = 50_000;
/** Longest fragment payload we try to read (a compressed or base64 link is never this long for 50k chars). */
const MAX_PAYLOAD_CHARS = 300_000;
/** Prefix of a deflate-compressed payload. "." is not in the base64url alphabet, so it cannot clash with plain text. */
const DEFLATE_PREFIX = 'z.';

export type ShareResult = { ok: true; fragment: string } | { ok: false; error: string };
export type ReadResult = { ok: true; source: string } | { ok: false; error: string };

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Returns null when the text is not valid base64url. */
export function base64UrlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.codePointAt(i) ?? 0;
    return out;
  } catch {
    return null;
  }
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** DOM's BufferSource, declared here because core compiles without the DOM lib. */
type BufferSource = ArrayBufferView | ArrayBuffer;

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, maxOut: number): Promise<Uint8Array | null> {
  // Written straight to the stream (not via Blob.stream(), which jsdom and some older browsers lack).
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxOut) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/**
 * Builds the fragment (without "#") that holds the source: `code=` + base64url of the UTF-8 text, or `code=z.` +
 * base64url of its raw deflate when the browser can compress and that is shorter.
 */
export async function encodeShareFragment(source: string, opts: { compress?: boolean } = {}): Promise<ShareResult> {
  if (!source.trim()) return { ok: false, error: 'There is no diagram to share yet.' };
  if (source.length > MAX_SHARE_CHARS) {
    return { ok: false, error: `The source has ${source.length.toLocaleString('en-US')} characters. A share link holds up to ${MAX_SHARE_CHARS.toLocaleString('en-US')}. Download the .mmd file instead.` };
  }
  const bytes = new TextEncoder().encode(source);
  const plain = base64UrlEncode(bytes);
  if (opts.compress !== false && canCompress()) {
    try {
      const packed = await pipeBytes(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER);
      if (packed) {
        const z = DEFLATE_PREFIX + base64UrlEncode(packed);
        if (z.length < plain.length) return { ok: true, fragment: `code=${z}` };
      }
    } catch { /* fall back to the plain form */ }
  }
  return { ok: true, fragment: `code=${plain}` };
}

/** Reads `#code=…` (with or without "#"). Returns null when the fragment has no code. */
export async function decodeShareFragment(hash: string): Promise<ReadResult | null> {
  const m = /(?:^#?|&)code=([^&]*)/.exec(hash);
  if (!m) return null;
  const bad: ReadResult = { ok: false, error: 'The diagram in this link could not be read. The link may be cut short or changed.' };
  const payload = m[1];
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return bad;
  const compressed = payload.startsWith(DEFLATE_PREFIX);
  let bytes = base64UrlDecode(compressed ? payload.slice(DEFLATE_PREFIX.length) : payload);
  if (!bytes) return bad;
  // A UTF-8 character is at most 4 bytes, so a valid 50k-character source is never larger than this.
  const maxBytes = MAX_SHARE_CHARS * 4;
  if (compressed) {
    if (!canCompress()) return { ok: false, error: 'This link is compressed and this browser cannot decompress it. Open it in a current browser.' };
    try {
      bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'), maxBytes);
    } catch {
      return bad;
    }
    if (!bytes) return { ok: false, error: `The diagram in this link is longer than ${MAX_SHARE_CHARS.toLocaleString('en-US')} characters.` };
  } else if (bytes.length > maxBytes) {
    return { ok: false, error: `The diagram in this link is longer than ${MAX_SHARE_CHARS.toLocaleString('en-US')} characters.` };
  }
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return bad;
  }
  if (source.length > MAX_SHARE_CHARS) return { ok: false, error: `The diagram in this link is longer than ${MAX_SHARE_CHARS.toLocaleString('en-US')} characters.` };
  return { ok: true, source };
}

const TYPE_RULES: ReadonlyArray<[RegExp, string]> = [
  [/^(flowchart|graph)\b/, 'Flowchart'],
  [/^sequenceDiagram\b/, 'Sequence diagram'],
  [/^classDiagram(-v2)?\b/, 'Class diagram'],
  [/^stateDiagram(-v2)?\b/, 'State diagram'],
  [/^erDiagram\b/, 'Entity relationship diagram'],
  [/^gantt\b/, 'Gantt chart'],
  [/^pie\b/, 'Pie chart'],
  [/^xychart(-beta)?\b/, 'XY chart'],
  [/^sankey(-beta)?\b/, 'Sankey diagram'],
  [/^quadrantChart\b/, 'Quadrant chart'],
  [/^mindmap\b/, 'Mind map'],
  [/^timeline\b/, 'Timeline'],
  [/^gitGraph\b/, 'Git graph'],
  [/^journey\b/, 'User journey'],
  [/^radar-beta\b/, 'Radar chart'],
  [/^treemap(-beta)?\b/, 'Treemap'],
  [/^venn-beta\b/, 'Venn diagram'],
  [/^block(-beta)?\b/, 'Block diagram'],
  [/^packet(-beta)?\b/, 'Packet diagram'],
  [/^kanban\b/, 'Kanban board'],
  [/^architecture(-beta)?\b/, 'Architecture diagram'],
  [/^requirementDiagram\b/, 'Requirement diagram'],
  [/^C4(Context|Container|Component|Dynamic|Deployment)\b/, 'C4 diagram'],
];

/**
 * Names the diagram type from its first statement, skipping blank lines, `%%` comments and directives, and a YAML
 * front-matter block. Returns '' when the type is unknown.
 */
export function detectDiagramType(source: string): string {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i]?.trim() === '---') {
    const end = lines.findIndex((l, j) => j > i && l.trim() === '---');
    if (end < 0) return '';
    i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    for (const [re, name] of TYPE_RULES) if (re.test(line)) return name;
    return '';
  }
  return '';
}

/** Wraps the source in a fenced block that GitHub, GitLab and this site's Markdown preview draw as a diagram. */
export function toMarkdownBlock(source: string): string {
  const longest = Math.max(2, ...(source.match(/`+/g) ?? []).map(s => s.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}mermaid\n${source.trimEnd()}\n${fence}\n`;
}
