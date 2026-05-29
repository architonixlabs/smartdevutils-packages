import { UAParser } from 'ua-parser-js'

export function parseUserAgent(ua?: string): { browser: string; version: string; os: string; device: 'desktop' | 'mobile' | 'tablet' } {
  const parser = new UAParser(ua)
  const browser = parser.getBrowser()
  const os = parser.getOS()
  const device = parser.getDevice()
  const deviceType = device.type === 'mobile' ? 'mobile' : device.type === 'tablet' ? 'tablet' : 'desktop'
  return {
    browser: browser.name ?? 'Unknown',
    version: browser.version ?? 'Unknown',
    os: `${os.name ?? 'Unknown'} ${os.version ?? ''}`.trim(),
    device: deviceType,
  }
}

export function detectBrowser(): string { return parseUserAgent().browser }
export function detectOs(): string { return parseUserAgent().os }
