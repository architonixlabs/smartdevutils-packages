export function parseIpAddress(ip: string): { version: 4 | 6; octets: number[]; valid: boolean } {
  if (ip.includes(':')) {
    return { version: 6, octets: [], valid: true }
  }
  const parts = ip.split('.')
  if (parts.length !== 4) return { version: 4, octets: [], valid: false }
  const octets = parts.map(Number)
  const valid = octets.every(o => !isNaN(o) && o >= 0 && o <= 255)
  return { version: 4, octets, valid }
}

export function isPrivateIp(ip: string): boolean {
  const { octets, valid } = parseIpAddress(ip)
  if (!valid) return false
  const [a, b] = octets
  return a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127
}

export function ipToInt(ip: string): number {
  const { octets } = parseIpAddress(ip)
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
}

export function intToIp(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.')
}

export function parseHttpHeaders(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split(/\r?\n/)
      .filter(line => line.includes(':'))
      .map(line => {
        const idx = line.indexOf(':')
        return [line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()]
      })
  )
}

const HTTP_STATUS: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
}

export function classifyHttpStatus(code: number): { category: string; description: string } {
  let category = 'Unknown'
  if (code >= 100 && code < 200) category = 'Informational'
  else if (code >= 200 && code < 300) category = 'Success'
  else if (code >= 300 && code < 400) category = 'Redirection'
  else if (code >= 400 && code < 500) category = 'Client Error'
  else if (code >= 500 && code < 600) category = 'Server Error'
  return { category, description: HTTP_STATUS[code] ?? `HTTP ${code}` }
}
