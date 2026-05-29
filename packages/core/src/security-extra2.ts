export type CspDirectives = {
  defaultSrc?: string[]
  scriptSrc?: string[]
  styleSrc?: string[]
  imgSrc?: string[]
  connectSrc?: string[]
  fontSrc?: string[]
  objectSrc?: string[]
  mediaSrc?: string[]
  frameSrc?: string[]
  reportUri?: string
}

const DIRECTIVE_MAP: Record<keyof Omit<CspDirectives, 'reportUri'>, string> = {
  defaultSrc: 'default-src',
  scriptSrc: 'script-src',
  styleSrc: 'style-src',
  imgSrc: 'img-src',
  connectSrc: 'connect-src',
  fontSrc: 'font-src',
  objectSrc: 'object-src',
  mediaSrc: 'media-src',
  frameSrc: 'frame-src',
}

export function buildCspHeader(directives: CspDirectives): string {
  const parts: string[] = []
  for (const [key, cssName] of Object.entries(DIRECTIVE_MAP)) {
    const vals = directives[key as keyof CspDirectives] as string[] | undefined
    if (vals?.length) parts.push(`${cssName} ${vals.join(' ')}`)
  }
  if (directives.reportUri) parts.push(`report-uri ${directives.reportUri}`)
  return parts.join('; ')
}

export function validateCsp(header: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!header.includes('default-src')) {
    warnings.push("Missing 'default-src' directive — recommended as fallback")
  }

  if (header.includes("'unsafe-eval'")) {
    errors.push("'unsafe-eval' allows arbitrary code execution — remove it")
  }

  if (header.includes("'unsafe-inline'")) {
    warnings.push("'unsafe-inline' weakens XSS protection — use nonces instead")
  }

  if (header.includes('*')) {
    warnings.push("Wildcard '*' in source list is overly permissive")
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function parseCorsPolicy(
  headers: Record<string, string>,
): { allowed: boolean; origins: string[]; methods: string[] } {
  const origin =
    headers['access-control-allow-origin'] ??
    headers['Access-Control-Allow-Origin']
  const methods =
    headers['access-control-allow-methods'] ??
    headers['Access-Control-Allow-Methods']

  if (!origin) {
    return { allowed: false, origins: [], methods: [] }
  }

  return {
    allowed: true,
    origins: origin.split(',').map((o) => o.trim()),
    methods: methods ? methods.split(',').map((m) => m.trim()) : [],
  }
}

const CONVENTIONAL_RE = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?!?: .+/

export function gitCommitLint(
  message: string,
): { valid: boolean; errors: string[]; convention: 'conventional' | 'unknown' } {
  const errors: string[] = []

  if (!message.trim()) {
    errors.push('Commit message cannot be empty')
  }

  if (message.length > 72) {
    errors.push('Subject line exceeds 72 characters')
  }

  if (message !== message.trimStart()) {
    errors.push('Commit message must not start with whitespace')
  }

  const convention = CONVENTIONAL_RE.test(message) ? 'conventional' : 'unknown'

  return { valid: errors.length === 0, errors, convention }
}
