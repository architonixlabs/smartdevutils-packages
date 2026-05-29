import he from 'he';

export function base64Encode(input: string): string {
  const bytes = encodeURIComponent(input).replace(
    /%([0-9A-F]{2})/g,
    (_, p1: string) => String.fromCharCode(parseInt(p1, 16))
  );
  return btoa(bytes);
}

export function base64Decode(input: string): string {
  let raw: string;
  try {
    raw = atob(input);
  } catch {
    throw new Error(`Invalid base64 input: ${input}`);
  }
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(raw, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    throw new Error(`base64 input decodes to non-UTF-8 bytes: ${input}`);
  }
}

export function urlEncode(input: string): string {
  return encodeURIComponent(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input);
}

export function htmlEncode(input: string): string {
  return he.encode(input);
}

export function htmlDecode(input: string): string {
  return he.decode(input);
}

export function stringEscape(input: string): string {
  return JSON.stringify(input).slice(1, -1);
}

export function stringUnescape(input: string): string {
  return JSON.parse(`"${input}"`);
}
