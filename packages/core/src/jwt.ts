function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64').toString('utf8');
}

export function jwtDecode(input: string): string {
  const parts = input.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Not a valid JWT');
  }
  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  return JSON.stringify({ header, payload }, null, 2);
}
