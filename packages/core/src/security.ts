import CryptoJS from 'crypto-js';

export interface SecretMatch { type: string; match: string; line: number; }

const SECRET_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { type: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|AWS_SECRET)[=:\s]+([A-Za-z0-9/+=]{40})/ },
  { type: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)[=:\s]+["']?([A-Za-z0-9_\-]{20,})["']?/i },
  { type: 'Bearer Token', pattern: /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/ },
  { type: 'Private Key Header', pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { type: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9]{36}/ },
  { type: 'Slack Token', pattern: /xox[baprs]-[0-9A-Za-z\-]{10,}/ },
  { type: 'Password in env', pattern: /(?:password|passwd|pwd)[=:\s]+["']?([^\s"']{8,})["']?/i },
];

export function scanForSecrets(text: string): SecretMatch[] {
  const results: SecretMatch[] = [];
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    for (const { type, pattern } of SECRET_PATTERNS) {
      const m = line.match(pattern);
      if (m) results.push({ type, match: m[0].slice(0, 60), line: idx + 1 });
    }
  });
  return results;
}

export function hmacSha256(message: string, key: string): string {
  return CryptoJS.HmacSHA256(message, key).toString(CryptoJS.enc.Hex);
}

export function sha384(input: string): string {
  return CryptoJS.SHA384(input).toString(CryptoJS.enc.Hex);
}

export function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
  return atob(padded);
}
