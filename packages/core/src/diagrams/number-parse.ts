// Number and delimited-text parsing used by the chart builder. Copied from the website's
// features/data-tools/descriptive-statistics.ts (only the parts chart-maker needs).

export type NumberLocale = 'none' | 'comma' | 'dot';
/** Tokens read as a missing value (case-insensitive), in addition to blank cells. */
export const MISSING_TOKENS = ['na', 'n/a', 'null', 'nan'];
const MISSING = new Set(MISSING_TOKENS);

const PLAIN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const COMMA_GROUPED = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;
const DOT_GROUPED = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d*)?$/;
const DECIMAL_COMMA = /^[+-]?(?:\d+,?\d*|,\d+)(?:[eE][+-]?\d+)?$/;

/** Spaces used as thousands separators (no-break, narrow no-break, thin), read only when a locale is chosen. */
const SPACE_GROUPING = /(?<=\d)[   ](?=\d)/g;

/** Parses one cell. Returns a number, 'missing', or null for text that is not a number. */
export function parseCell(raw: string, locale: NumberLocale = 'none'): number | 'missing' | null {
  let t = raw.trim();
  if (t === '') return 'missing';
  // Unicode minus sign (U+2212), common in text copied from Word, Excel or PDFs.
  if (t.indexOf('−') >= 0) t = t.replace(/−/g, '-');
  if (locale === 'none') {
    // Fast path: Number() accepts everything PLAIN does. Its extras are hex/binary/octal literals (0x…, 0b…, 0o…;
    // a sign makes them NaN) and Infinity, which is not finite, so those are the only cases to rule out.
    const n = +t;
    if (Number.isFinite(n)) {
      const c1 = t.length > 1 ? t.charCodeAt(1) | 0x20 : 0;
      return t.charCodeAt(0) === 48 && (c1 === 0x78 || c1 === 0x62 || c1 === 0x6f) ? null : n;
    }
  }
  if (MISSING.has(t.toLowerCase())) return 'missing';
  if (locale !== 'none') t = t.replace(SPACE_GROUPING, locale === 'comma' ? ',' : '.');
  let s = t;
  if (locale === 'comma') {
    if (COMMA_GROUPED.test(t)) s = t.replace(/,/g, '');
  } else if (locale === 'dot') {
    if (DOT_GROUPED.test(t)) s = t.replace(/\./g, '').replace(',', '.');
    else if (DECIMAL_COMMA.test(t)) s = t.replace(',', '.');
    else return null; // in decimal-comma mode a dot is only valid as a thousands separator
  }
  if (!PLAIN.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** RFC 4180 CSV: quoted fields may hold the delimiter, doubled quotes and line breaks. Keeps blank lines out. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const endRow = () => {
    row.push(cell);
    if (row.length > 1 || quoted || row[0].trim() !== '') rows.push(row);
    row = []; cell = ''; quoted = false;
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      inQuotes = true; quoted = true; cell = '';
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else cell += ch;
  }
  if (cell !== '' || row.length || quoted) endRow();
  return rows;
}

