export interface CidrInfo {
  network: string; broadcast: string; hosts: number; prefix: number; mask: string;
}

export function envToJson(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export function cidrExpand(cidr: string): CidrInfo {
  const [ip, prefixStr] = cidr.split('/');
  if (!ip || prefixStr === undefined) throw new Error('Invalid CIDR notation');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error('Invalid prefix length');
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) throw new Error('Invalid IP address');
  const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  const maskNum = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkNum = (ipNum & maskNum) >>> 0;
  const broadcastNum = (networkNum | (~maskNum >>> 0)) >>> 0;
  const numToIp = (n: number) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255].join('.');
  const hostBits = 32 - prefix;
  const hosts = prefix === 32 ? 0 : prefix === 31 ? 2 : Math.pow(2, hostBits) - 2;
  return { network: numToIp(networkNum), broadcast: numToIp(broadcastNum), hosts: Math.max(0, hosts), prefix, mask: numToIp(maskNum) };
}
