// Chart Maker engine: reads pasted data (CSV, TSV, semicolon, Markdown table, JSON, "label: value" lines) and
// builds Mermaid chart source (pie, xychart, sankey, quadrantChart, radar, treemap). Pure functions with no Angular
// or browser dependencies, so they run during prerender and in tests.
//
// Keywords: the "-beta" spellings (xychart-beta, sankey-beta, radar-beta, treemap-beta) are used on purpose. Mermaid
// 12.2 accepts them for all four (radar accepts only radar-beta), and the older Mermaid builds used by GitHub, GitLab
// and Notion know only those spellings.

import { NumberLocale, parseCell, parseDelimited } from './number-parse';

export type { NumberLocale } from './number-parse';

export type ChartType = 'pie' | 'bar' | 'hbar' | 'line' | 'barline' | 'sankey' | 'quadrant' | 'radar' | 'treemap';
export type InputFormat = 'auto' | 'csv' | 'tsv' | 'semicolon' | 'markdown' | 'json' | 'lines';
export type DetectedFormat = Exclude<InputFormat, 'auto'>;
export type HeaderMode = 'auto' | 'yes' | 'no';
export type SortOrder = 'none' | 'asc' | 'desc';

export const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'pie', label: 'Pie' },
  { id: 'bar', label: 'Bar' },
  { id: 'hbar', label: 'Horizontal bar' },
  { id: 'line', label: 'Line' },
  { id: 'barline', label: 'Bar + line' },
  { id: 'sankey', label: 'Sankey' },
  { id: 'quadrant', label: 'Quadrant' },
  { id: 'radar', label: 'Radar' },
  { id: 'treemap', label: 'Treemap' },
];

export const INPUT_FORMATS: { id: InputFormat; label: string }[] = [
  { id: 'auto', label: 'Detect automatically' },
  { id: 'csv', label: 'CSV (comma)' },
  { id: 'tsv', label: 'TSV (tab)' },
  { id: 'semicolon', label: 'Semicolon separated' },
  { id: 'markdown', label: 'Markdown table' },
  { id: 'json', label: 'JSON' },
  { id: 'lines', label: 'Lines: label: value' },
];

export const FORMAT_NAMES: Record<DetectedFormat, string> = {
  csv: 'CSV', tsv: 'TSV', semicolon: 'semicolon-separated text', markdown: 'a Markdown table', json: 'JSON', lines: 'label/value lines',
};

/** Number formats offered in the UI. Thousands commas are the default because they are common in pasted reports. */
export const CHART_LOCALES: { id: NumberLocale; label: string }[] = [
  { id: 'comma', label: '1,234.5 (comma thousands)' },
  { id: 'dot', label: '1.234,5 (decimal comma)' },
  { id: 'none', label: '1234.5 (plain only)' },
];

/** Most categories, points, links or boxes drawn per chart type. More is unreadable and slow to draw. */
export const CAPS: Record<ChartType, number> = {
  pie: 50, bar: 50, hbar: 50, line: 100, barline: 100, sankey: 300, quadrant: 100, radar: 30, treemap: 300,
};
/** Most series (value columns) drawn on line, bar + line and radar charts. */
export const MAX_SERIES = 8;
/** Longest label kept; longer ones are cut with an ellipsis. */
export const MAX_LABEL = 80;
const MAX_INPUT = 2_000_000;

export interface ChartTable {
  headers: string[];
  rows: string[][];
  format: DetectedFormat;
  hasHeader: boolean;
}

export interface ColumnProfile {
  index: number;
  name: string;
  nonEmpty: number;
  numeric: number;
  kind: 'number' | 'text' | 'date';
}

export interface ChartMapping {
  /** Label (category) column; for sankey the source, for treemap the path or child name. */
  label: number;
  /** Value columns (series). */
  values: number[];
  /** Sankey target column. */
  target: number;
  /** Quadrant x and y columns. */
  x: number;
  y: number;
  /** Treemap parent column, or -1 to read paths from the label column. */
  parent: number;
}

export interface ChartOptions {
  title: string;
  xTitle: string;
  yTitle: string;
  sort: SortOrder;
  /** Keep the N largest categories and group the rest as "Other" (pie and bar). 0 = off. */
  topN: number;
  showValues: boolean;
  yMin: number | null;
  yMax: number | null;
  /** Quadrant names, comma separated: top right, top left, bottom left, bottom right. */
  quadrants: string;
  /** Treemap path separator; '' = detect (/ \ > |). */
  separator: string;
}

export const DEFAULT_OPTIONS: ChartOptions = {
  title: '', xTitle: '', yTitle: '', sort: 'none', topN: 0, showValues: true, yMin: null, yMax: null, quadrants: '', separator: '',
};

export interface ChartResult {
  mermaid: string;
  error: string | null;
  /** Plain-English notes: caps, scaling, ignored settings. */
  notes: string[];
  /** Data rows (1-based, after the header) that were skipped because a value was not a number. */
  skippedRows: number[];
  skippedCount: number;
  /** Categories, points, links or boxes drawn. */
  items: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Numbers

const CURRENCY = /[$€£¥₹₩₽₺₪₫฿₴₦₱¢]/g;
const CODE = /^(?:USD|EUR|GBP|INR|JPY|CNY|CAD|AUD|CHF|SEK|NOK|DKK|BRL|MXN|ZAR|SGD|HKD|NZD|KRW|RUB|PLN|TRY)\s*|\s*(?:USD|EUR|GBP|INR|JPY|CNY|CAD|AUD|CHF|SEK|NOK|DKK|BRL|MXN|ZAR|SGD|HKD|NZD|KRW|RUB|PLN|TRY)$/i;

/**
 * Reads a number from a cell: currency symbols and codes, a trailing percent sign, plain spaces between digit groups
 * and accounting brackets "(1,234)" for negatives are accepted. Returns null for anything else, including blanks.
 */
export function parseNumber(raw: string, locale: NumberLocale = 'comma'): number | null {
  let t = (raw ?? '').trim();
  if (!t) return null;
  let negative = false;
  if (/^\(.*\)$/.test(t)) { negative = true; t = t.slice(1, -1).trim(); }
  t = t.replace(CURRENCY, '').replace(CODE, '').trim();
  if (t.endsWith('%')) t = t.slice(0, -1).trim();
  // "- 5" or "-$5" leaves a sign separated from the digits.
  t = t.replace(/^([+\-−])\s+/, '$1');
  if (locale !== 'none') t = t.replace(/(?<=\d) (?=\d{3}(?:\D|$))/g, locale === 'comma' ? ',' : '.');
  if (!t) return null;
  const v = parseCell(t, locale);
  if (typeof v !== 'number') return null;
  return negative ? -Math.abs(v) : v;
}

/** Plain decimal text for Mermaid (which does not read exponents such as 1e-7), at most 6 decimals. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 1e6) / 1e6;
  return (Object.is(r, -0) ? 0 : r).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 6 });
}

/** Rounds up to a tidy axis maximum: 1, 2, 2.5, 5 times a power of ten. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v - 1e-12 * p) return m * p;
  return 10 * p;
}

// ---------------------------------------------------------------------------------------------------------------
// Escaping

/** Common clean-up for any text placed in Mermaid source. */
function clean(s: string): string {
  let t = String(s ?? '').replace(/[\r\n\t\v\f]+/g, ' ');
  while (t.includes('%%')) t = t.replace(/%%/g, '%');
  // Mermaid decodes "#name;" and "#123;" as entity codes; the bare form keeps the text as typed.
  t = t.replace(/#(\w+);/g, '#$1').replace(/\s+/g, ' ').trim();
  return t.length > MAX_LABEL ? t.slice(0, MAX_LABEL - 1).trimEnd() + '…' : t;
}

/** Text for a double-quoted Mermaid string. The grammars have no escape for a double quote, so it becomes '. */
export function quoteLabel(s: string): string {
  const t = clean(s).replace(/"/g, "'");
  return `"${t || '(blank)'}"`;
}

/** Text for an unquoted title line (pie, quadrant, radar, treemap read the rest of the line as is). */
export function rawText(s: string): string {
  return clean(s).replace(/"/g, "'");
}

const PUNCT: Record<string, string> = { '‘': "'", '’': "'", '‚': "'", '“': "'", '”': "'", '„': "'", '–': '-', '—': '-', '−': '-', '…': '...', '•': '*', '·': '.', ' ': ' ', '×': 'x', 'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'ø': 'o', 'Ø': 'O', 'œ': 'oe', 'Œ': 'OE', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };

/**
 * Mermaid's sankey grammar reads printable ASCII only. Accents are dropped (é → e), common punctuation is mapped
 * and any other character becomes "?".
 */
export function toAscii(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^ -~]/g, ch => PUNCT[ch] ?? '?');
}

/** One RFC 4180 field for sankey's CSV body: always quoted, inner quotes doubled, ASCII only. */
export function csvField(s: string): string {
  const t = toAscii(clean(s) || '(blank)');
  return `"${t.replace(/"/g, '""')}"`;
}

// ---------------------------------------------------------------------------------------------------------------
// Input parsing

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
}

const MD_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const KV_LINE = /^\s*(.+?)\s*[:=]\s+(\S.*?)\s*$|^\s*(.+?)\s*[:=](\S.*?)\s*$/;

/** Guesses the input format from its first lines. */
export function detectFormat(text: string): DetectedFormat {
  const t = text.replace(/^﻿/, '').trim();
  if (/^[[{]/.test(t)) {
    try { JSON.parse(t); return 'json'; } catch { /* not JSON, fall through */ }
  }
  const lines = nonEmptyLines(t).slice(0, 50);
  if (lines.length >= 2 && lines.slice(0, 3).some(l => MD_SEPARATOR.test(l) && l.includes('-')) && lines[0].includes('|')) return 'markdown';
  const consistent = (ch: string) => {
    const counts = lines.map(l => l.split(ch).length - 1);
    const withIt = counts.filter(c => c > 0).length;
    return withIt >= Math.max(1, Math.ceil(lines.length * 0.8)) && counts[0] > 0;
  };
  if (consistent('\t')) return 'tsv';
  if (consistent(';')) return 'semicolon';
  // "label: value" lines win over commas, which can be thousands separators in the value. The first line may be a
  // header ("Browser: Share"); every other value must read as a number in one of the formats.
  const kvNumber = (l: string) => {
    const m = KV_LINE.exec(l);
    const v = m ? (m[2] ?? m[4]) : '';
    return !!m && (parseNumber(v, 'comma') !== null || parseNumber(v, 'dot') !== null);
  };
  if (lines.length && KV_LINE.test(lines[0]) && lines.slice(1).every(kvNumber) && (lines.length > 1 || kvNumber(lines[0]))) return 'lines';
  if (consistent(',')) return 'csv';
  return 'lines';
}

function parseMarkdown(text: string): string[][] {
  return nonEmptyLines(text)
    .filter(l => !MD_SEPARATOR.test(l))
    .map(l => {
      let s = l.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
      return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
    });
}

function cellText(v: unknown, locale: NumberLocale): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  // JSON numbers always use a decimal dot; write them the way the chosen number format reads them.
  if (typeof v === 'number') return locale === 'dot' ? String(v).replace('.', ',') : String(v);
  if (typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

interface RawTable { rows: string[][]; headers?: string[] }

function parseJson(text: string, locale: NumberLocale): RawTable | string {
  const cell = (v: unknown) => cellText(v, locale);
  let data: unknown;
  try { data = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { return `This is not valid JSON: ${(e as Error).message}`; }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    // A wrapper such as { "data": [...] }: use its first array of rows.
    const inner = Object.values(obj).find(v => Array.isArray(v) && v.length && typeof v[0] === 'object');
    if (inner) data = inner;
    else return { headers: ['Label', 'Value'], rows: Object.entries(obj).map(([k, v]) => [k, cell(v)]) };
  }
  if (!Array.isArray(data)) return 'JSON input must be an array of objects, an array of [label, value] pairs, or an object of label: value.';
  if (!data.length) return 'The JSON array is empty.';
  if (data.every(r => Array.isArray(r))) return { rows: (data as unknown[][]).map(r => r.map(cell)) };
  if (data.every(r => r && typeof r === 'object')) {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const r of data as Record<string, unknown>[]) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
    return { headers: keys, rows: (data as Record<string, unknown>[]).map(r => keys.map(k => cell(r[k]))) };
  }
  return { headers: ['Value'], rows: data.map(v => [cell(v)]) };
}

function parseLines(text: string, locale: NumberLocale): string[][] {
  return nonEmptyLines(text).map(l => {
    const kv = KV_LINE.exec(l);
    if (kv) {
      const label = kv[1] ?? kv[3];
      const value = kv[2] ?? kv[4];
      if (parseNumber(value, locale) !== null || !/\s\S+$/.test(l)) return [label, value];
    }
    // "label value": the last space-separated token is the value.
    const m = /^\s*(.*?)\s+(\S+)\s*$/.exec(l);
    return m ? [m[1], m[2]] : [l.trim()];
  });
}

const looksNumeric = (c: string, locale: NumberLocale) => parseNumber(c, locale) !== null;

/** First row is a header when it has no numbers while some column below it does. */
function detectHeader(rows: string[][], locale: NumberLocale): boolean {
  if (rows.length < 2) return false;
  const first = rows[0];
  const rest = rows.slice(1, 50);
  if (first.some(c => looksNumeric(c, locale))) {
    // Years as series names ("Region,2024,2025") are a header when the cells below them are not years.
    const year = (c: string) => /^(?:19|20)\d{2}$/.test(c.trim());
    return first.some(c => !looksNumeric(c, locale) && c.trim() !== '')
      && first.every((c, i) => !looksNumeric(c, locale) || (year(c) && rest.some(r => looksNumeric(r[i] ?? '', locale) && !year(r[i] ?? ''))));
  }
  return first.some((_, i) => rest.some(r => looksNumeric(r[i] ?? '', locale)));
}

/** Reads the input into a table of strings. Column names come from the header row or are "Column 1" and so on. */
export function parseTable(text: string, format: InputFormat = 'auto', header: HeaderMode = 'auto', locale: NumberLocale = 'comma'): ChartTable | { error: string } {
  if (text.length > MAX_INPUT) return { error: `The input is larger than ${MAX_INPUT / 1_000_000} MB. Paste a smaller extract.` };
  if (!text.trim()) return { error: 'Paste some data first.' };
  const fmt = format === 'auto' ? detectFormat(text) : format;
  let raw: RawTable;
  if (fmt === 'json') {
    const r = parseJson(text, locale);
    if (typeof r === 'string') return { error: r };
    raw = r;
  } else if (fmt === 'markdown') raw = { rows: parseMarkdown(text) };
  else if (fmt === 'lines') raw = { rows: parseLines(text, locale) };
  else raw = { rows: parseDelimited(text, fmt === 'tsv' ? '\t' : fmt === 'semicolon' ? ';' : ',') };

  let rows = raw.rows.map(r => r.map(c => c.trim()));
  let headers = raw.headers;
  let hasHeader = !!headers;
  if (!headers) {
    hasHeader = header === 'yes' || (header === 'auto' && detectHeader(rows, locale));
    if (hasHeader) { headers = rows[0]; rows = rows.slice(1); }
  }
  const width = Math.max(headers?.length ?? 0, ...rows.slice(0, 5000).map(r => r.length));
  if (!width || !rows.length) return { error: 'No data rows were found.' };
  const names: string[] = [];
  for (let i = 0; i < width; i++) {
    let n = (headers?.[i] ?? '').trim() || `Column ${i + 1}`;
    if (names.includes(n)) n = `${n} (${i + 1})`;
    names.push(n);
  }
  rows = rows.map(r => (r.length < width ? [...r, ...Array(width - r.length).fill('')] : r));
  return { headers: names, rows, format: fmt, hasHeader };
}

// ---------------------------------------------------------------------------------------------------------------
// Profiling and suggestions

const MONTHS = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:[\s'-]*\d{2,4})?$/i;
const DATE_LIKE = [
  /^\d{4}-\d{1,2}(?:-\d{1,2})?(?:[T ][\d:.]+Z?)?$/,
  /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  /^\d{4}[/.]\d{1,2}(?:[/.]\d{1,2})?$/,
  /^(?:19|20)\d{2}$/,
  /^(?:Q[1-4][\s-]*(?:'?\d{2,4})?|(?:19|20)\d{2}[\s-]*Q[1-4])$/i,
  /^(?:W(?:eek)?\s?\d{1,2}|H[12][\s-]*\d{0,4})$/i,
  /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i,
  MONTHS,
];

/** True for labels that read as dates or periods (2025-01, Jan, Q1 2025, 2024, Week 3, Mon). */
export function isDateLike(s: string): boolean {
  const t = s.trim();
  return !!t && DATE_LIKE.some(r => r.test(t));
}

export function profileColumns(table: ChartTable, locale: NumberLocale = 'comma'): ColumnProfile[] {
  const sample = table.rows.slice(0, 2000);
  return table.headers.map((name, index) => {
    let nonEmpty = 0, numeric = 0, dates = 0;
    for (const r of sample) {
      const c = r[index] ?? '';
      if (!c) continue;
      nonEmpty++;
      if (looksNumeric(c, locale)) numeric++;
      if (isDateLike(c)) dates++;
    }
    // A column of bare years reads as dates when it is the first column, otherwise as numbers.
    const kind: ColumnProfile['kind'] = nonEmpty && dates >= nonEmpty * 0.8 && (numeric < nonEmpty || index === 0) ? 'date'
      : nonEmpty && numeric >= nonEmpty * 0.6 ? 'number' : 'text';
    return { index, name, nonEmpty, numeric, kind };
  });
}

export interface ChartSuggestion { type: ChartType; reason: string }

/** A gentle hint from the data's shape. Returns null when nothing fits better than the current choice. */
export function suggestChart(table: ChartTable, profiles: ColumnProfile[]): ChartSuggestion | null {
  const nums = profiles.filter(p => p.kind === 'number');
  const texts = profiles.filter(p => p.kind === 'text');
  const dates = profiles.filter(p => p.kind === 'date');
  const rows = table.rows.length;
  if (!nums.length) return null;
  if (texts.length >= 2 && nums.length === 1 && profiles.length === 3) {
    return { type: 'sankey', reason: 'two text columns and one number read as source, target and amount' };
  }
  const label = dates[0] ?? texts[0];
  if (!label) return null;
  const labels = table.rows.map(r => r[label.index] ?? '');
  if (label.kind === 'text' && nums.length === 1 && labels.filter(l => /[/\\>]/.test(l)).length >= rows * 0.6) {
    return { type: 'treemap', reason: 'the labels look like paths (a/b/c)' };
  }
  if (label.kind === 'date') {
    return nums.length >= 2
      ? { type: 'line', reason: 'the labels are dates or periods, and there are several number columns' }
      : { type: 'line', reason: 'the labels are dates or periods' };
  }
  if (nums.length === 2) {
    const names = nums.map(n => n.name.toLowerCase()).join(' ');
    if (/\bx\b.*\by\b|effort|impact|cost|value|risk|likelihood|urgency|importance/.test(names) && /effort|impact|\bx\b|risk|likelihood|urgency|importance/.test(names)) {
      return { type: 'quadrant', reason: 'one label and two scores (x and y) place items on a 2 × 2 grid' };
    }
  }
  if (nums.length >= 2 && rows >= 3 && rows <= 12) {
    const vals = table.rows.flatMap(r => nums.map(n => parseNumber(r[n.index] ?? '') ?? NaN)).filter(Number.isFinite);
    if (vals.length && Math.min(...vals) >= 0 && Math.max(...vals) <= 10) {
      return { type: 'radar', reason: 'several series of small scores over a few categories compare well on a radar' };
    }
  }
  if (nums.length >= 2) return { type: 'line', reason: 'several number columns; a line per column keeps them all visible' };
  const values = labels.length;
  if (values <= 8) return { type: 'pie', reason: 'one text column and one number column with few categories' };
  const longLabels = labels.reduce((a, l) => a + l.length, 0) / Math.max(1, values) > 14;
  return longLabels
    ? { type: 'hbar', reason: 'many categories with long names fit better side-on' }
    : { type: 'bar', reason: 'one text column and one number column' };
}

/** Sensible starting columns for each chart type. */
export function defaultMapping(profiles: ColumnProfile[]): ChartMapping {
  const nums = profiles.filter(p => p.kind === 'number').map(p => p.index);
  const nonNum = profiles.filter(p => p.kind !== 'number').map(p => p.index);
  const label = nonNum[0] ?? 0;
  const values = nums.filter(i => i !== label);
  const target = nonNum[1] ?? profiles.find(p => p.index !== label && !values.includes(p.index))?.index ?? (label === 0 ? 1 : 0);
  return {
    label,
    values: values.length ? values.slice(0, MAX_SERIES) : [profiles.length > 1 ? (label === 0 ? 1 : 0) : 0],
    target,
    x: values[0] ?? 1,
    y: values[1] ?? values[0] ?? 2,
    parent: -1,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Building

interface Series { labels: string[]; values: number[][] }

function newResult(): ChartResult {
  return { mermaid: '', error: null, notes: [], skippedRows: [], skippedCount: 0, items: 0 };
}

function skip(res: ChartResult, row: number): void {
  res.skippedCount++;
  if (res.skippedRows.length < 20) res.skippedRows.push(row);
}

function colName(table: ChartTable, i: number): string {
  return table.headers[i] ?? `Column ${i + 1}`;
}

function validCol(table: ChartTable, i: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < table.headers.length;
}

/** Label plus one number per value column, duplicate labels summed, first-seen order kept. */
function collect(table: ChartTable, label: number, cols: number[], locale: NumberLocale, res: ChartResult, accept?: (v: number) => boolean): Series & { rejected: number } {
  const index = new Map<string, number>();
  const labels: string[] = [];
  const values: number[][] = cols.map(() => []);
  let dup = 0, rejected = 0;
  table.rows.forEach((r, ri) => {
    const nums = cols.map(c => parseNumber(r[c] ?? '', locale));
    if (nums.some(n => n === null)) { skip(res, ri + 1); return; }
    if (accept && nums.some(n => !accept(n as number))) { rejected++; return; }
    const name = clean(r[label] ?? '') || '(blank)';
    const at = index.get(name);
    if (at === undefined) {
      index.set(name, labels.length);
      labels.push(name);
      nums.forEach((n, k) => values[k].push(n as number));
    } else {
      dup++;
      nums.forEach((n, k) => { values[k][at] += n as number; });
    }
  });
  if (dup) res.notes.push(`${dup} row${dup === 1 ? '' : 's'} repeated an earlier label; their values were added together.`);
  return { labels, values, rejected };
}

/** Sort by the first series, keep the top N with the rest summed as "Other", then cap. */
function arrange(s: Series, type: ChartType, o: ChartOptions, res: ChartResult): Series {
  let order = s.labels.map((_, i) => i);
  const first = s.values[0];
  const cap = CAPS[type];
  let other: number[] | null = null;
  const topN = Math.floor(o.topN);
  if ((type === 'pie' || type === 'bar' || type === 'hbar') && topN > 0 && order.length > topN) {
    const keep = new Set([...order].sort((a, b) => first[b] - first[a]).slice(0, topN));
    const rest = order.filter(i => !keep.has(i));
    other = s.values.map(v => rest.reduce((a, i) => a + v[i], 0));
    res.notes.push(`The ${rest.length} smallest categor${rest.length === 1 ? 'y was' : 'ies were'} grouped as "Other".`);
    order = order.filter(i => keep.has(i));
  }
  if (o.sort !== 'none' && (type === 'pie' || type === 'bar' || type === 'hbar' || type === 'radar')) {
    const dir = o.sort === 'asc' ? 1 : -1;
    order = [...order].sort((a, b) => dir * (first[a] - first[b]));
  }
  const room = other ? cap - 1 : cap;
  if (order.length > room) {
    res.notes.push(`Only the first ${room} of ${order.length} categories are drawn (limit ${cap}).${type === 'pie' || type === 'bar' || type === 'hbar' ? ' Use "Top N" to group the rest as Other.' : ''}`);
    order = order.slice(0, room);
  }
  const labels = order.map(i => s.labels[i]);
  const values = s.values.map(v => order.map(i => v[i]));
  if (other) {
    labels.push(labels.includes('Other') ? 'Other (rest)' : 'Other');
    other.forEach((v, k) => values[k].push(v));
  }
  return { labels, values };
}

function seriesCols(table: ChartTable, m: ChartMapping, res: ChartResult): number[] {
  const cols = [...new Set(m.values)].filter(c => validCol(table, c) && c !== m.label);
  if (cols.length > MAX_SERIES) {
    res.notes.push(`Only the first ${MAX_SERIES} value columns are drawn.`);
    return cols.slice(0, MAX_SERIES);
  }
  return cols;
}

function buildPie(table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  const cols = seriesCols(table, m, res);
  if (!cols.length) { res.error = 'Choose a value column.'; return; }
  if (cols.length > 1) res.notes.push(`A pie shows one series; only "${colName(table, cols[0])}" is used.`);
  const raw = collect(table, m.label, [cols[0]], locale, res, v => v >= 0);
  if (raw.rejected) res.notes.push(`${raw.rejected} row${raw.rejected === 1 ? '' : 's'} with a negative value ${raw.rejected === 1 ? 'was' : 'were'} skipped; a pie cannot show negative values.`);
  const s = arrange(raw, 'pie', o, res);
  if (!s.labels.length) { res.error = 'No rows with a number in the value column.'; return; }
  const lines = [o.showValues ? 'pie showData' : 'pie'];
  const title = rawText(o.title);
  if (title) lines.push(`    title ${title}`);
  s.labels.forEach((l, i) => lines.push(`    ${quoteLabel(l)} : ${formatNumber(s.values[0][i])}`));
  res.items = s.labels.length;
  res.mermaid = lines.join('\n');
}

function axisRange(values: number[], o: ChartOptions, fromZero: boolean, res: ChartResult): [number, number] | null {
  const finite = values.filter(Number.isFinite);
  const dataMin = finite.length ? Math.min(...finite) : 0;
  const dataMax = finite.length ? Math.max(...finite) : 0;
  if (o.yMin === null && o.yMax === null && !fromZero) return null;
  let lo = o.yMin ?? (fromZero ? Math.min(0, dataMin) : dataMin);
  let hi = o.yMax ?? (fromZero ? (dataMax > 0 ? niceCeil(dataMax) : 0) : dataMax);
  if (fromZero && o.yMin === null && lo < 0) lo = -niceCeil(-lo);
  if (hi <= lo) {
    if (o.yMin !== null || o.yMax !== null) res.notes.push('The y-axis range was ignored: the maximum must be larger than the minimum.');
    if (o.yMin !== null && o.yMax !== null) return fromZero ? axisRange(values, { ...o, yMin: null, yMax: null }, fromZero, res) : null;
    hi = lo + 1;
  }
  if ((o.yMin !== null && dataMin < o.yMin) || (o.yMax !== null && dataMax > o.yMax)) {
    res.notes.push('Some values fall outside the y-axis range you set and are cut off.');
  }
  return [lo, hi];
}

function buildXy(type: 'bar' | 'hbar' | 'line' | 'barline', table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  let cols = seriesCols(table, m, res);
  if (!cols.length) { res.error = 'Choose a value column.'; return; }
  if ((type === 'bar' || type === 'hbar') && cols.length > 1) {
    res.notes.push(`Mermaid's xychart draws several bar series on top of each other and has no stacked or grouped bars, so only "${colName(table, cols[0])}" is drawn. Use "Bar + line" or "Line" for more series.`);
    cols = [cols[0]];
  }
  if (type === 'barline' && cols.length < 2) res.notes.push('Choose a second value column to draw it as a line over the bars.');
  const s = arrange(collect(table, m.label, cols, locale, res), type, o, res);
  if (!s.labels.length) { res.error = 'No rows with numbers in the value columns.'; return; }
  const lines: string[] = [];
  // Value labels on bars are a chart setting, carried in the front matter so they travel with the text.
  if (o.showValues && type !== 'line') lines.push('---', 'config:', '  xyChart:', '    showDataLabel: true', '---');
  lines.push(type === 'hbar' ? 'xychart-beta horizontal' : 'xychart-beta');
  const title = clean(o.title);
  if (title) lines.push(`    title ${quoteLabel(title)}`);
  const xTitle = clean(o.xTitle) || (table.hasHeader ? colName(table, m.label) : '');
  lines.push(`    x-axis ${xTitle ? quoteLabel(xTitle) + ' ' : ''}[${s.labels.map(quoteLabel).join(', ')}]`);
  const hasBar = type !== 'line';
  const range = axisRange(s.values.flat(), o, hasBar, res);
  const yTitle = clean(o.yTitle) || (cols.length === 1 && table.hasHeader ? colName(table, cols[0]) : '');
  if (yTitle || range) {
    lines.push(`    y-axis${yTitle ? ' ' + quoteLabel(yTitle) : ''}${range ? ` ${formatNumber(range[0])} --> ${formatNumber(range[1])}` : ''}`);
  }
  s.values.forEach((v, k) => {
    const kind = type === 'line' || (type === 'barline' && k > 0) ? 'line' : 'bar';
    lines.push(`    ${kind} [${v.map(formatNumber).join(', ')}]`);
  });
  if (cols.length > 1) {
    const order = cols.map((c, k) => (type === 'barline' && k === 0 ? `bars: ${colName(table, c)}` : `line ${type === 'barline' ? k : k + 1}: ${colName(table, c)}`));
    res.notes.push(`Mermaid's xychart has no legend. Series in drawing order: ${order.join('; ')}.`);
  }
  res.items = s.labels.length;
  res.mermaid = lines.join('\n');
}

function buildSankey(table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  const valueCol = m.values.find(c => validCol(table, c) && c !== m.label && c !== m.target);
  if (!validCol(table, m.target) || m.target === m.label) { res.error = 'Choose different source and target columns.'; return; }
  if (valueCol === undefined) { res.error = 'Choose a value column (the amount that flows).'; return; }
  const pairs = new Map<string, { s: string; t: string; v: number }>();
  let selfLinks = 0, nonPositive = 0;
  table.rows.forEach((r, ri) => {
    const v = parseNumber(r[valueCol] ?? '', locale);
    if (v === null) { skip(res, ri + 1); return; }
    if (v <= 0) { nonPositive++; return; }
    const s = clean(r[m.label] ?? '') || '(blank)';
    const t = clean(r[m.target] ?? '') || '(blank)';
    if (s === t) { selfLinks++; return; }
    const key = `${s}\u0000${t}`;
    const p = pairs.get(key);
    if (p) p.v += v; else pairs.set(key, { s, t, v });
  });
  if (nonPositive) res.notes.push(`${nonPositive} link${nonPositive === 1 ? '' : 's'} with zero or negative amounts were skipped.`);
  if (selfLinks) res.notes.push(`${selfLinks} link${selfLinks === 1 ? '' : 's'} from a node to itself were skipped.`);
  let links = [...pairs.values()];
  if (links.length > CAPS.sankey) {
    res.notes.push(`Only the ${CAPS.sankey} largest of ${links.length} links are drawn.`);
    links = [...links].sort((a, b) => b.v - a.v).slice(0, CAPS.sankey);
  }
  // Mermaid's sankey refuses circular flows, so a link that closes a loop is left out.
  const out = new Map<string, Set<string>>();
  const reaches = (from: string, to: string): boolean => {
    const stack = [from], seen = new Set<string>();
    while (stack.length) {
      const n = stack.pop() as string;
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      out.get(n)?.forEach(x => stack.push(x));
    }
    return false;
  };
  // ASCII names for the sankey grammar; names that become equal get a number so separate nodes stay separate.
  const ascii = new Map<string, string>();
  const used = new Map<string, string>();
  let changed = 0;
  const nameOf = (n: string) => {
    let a = ascii.get(n);
    if (a !== undefined) return a;
    const base = toAscii(n);
    if (base !== n) changed++;
    a = base;
    for (let k = 2; used.has(a) && used.get(a) !== n; k++) a = `${base} (${k})`;
    used.set(a, n);
    ascii.set(n, a);
    return a;
  };
  const kept: typeof links = [];
  const loops: string[] = [];
  for (const l of links) {
    if (reaches(l.t, l.s)) { loops.push(`${l.s} → ${l.t}`); continue; }
    if (!out.has(l.s)) out.set(l.s, new Set());
    out.get(l.s)?.add(l.t);
    kept.push(l);
  }
  if (loops.length) res.notes.push(`Sankey diagrams cannot show loops; ${loops.length} link${loops.length === 1 ? '' : 's'} that would close one ${loops.length === 1 ? 'was' : 'were'} left out: ${loops.slice(0, 5).join(', ')}${loops.length > 5 ? ', …' : ''}.`);
  if (!kept.length) { res.error = 'No links to draw. Each row needs a source, a target and a positive amount.'; return; }
  if (clean(o.title)) res.notes.push("Mermaid's sankey diagram does not draw a title, so the title is left out.");
  const lines: string[] = ['sankey-beta', ''];
  for (const l of kept) lines.push(`${csvField(nameOf(l.s))},${csvField(nameOf(l.t))},${formatNumber(l.v)}`);
  if (changed) res.notes.push(`Mermaid's sankey accepts only plain ASCII text, so ${changed} node name${changed === 1 ? '' : 's'} lost accents or had other characters replaced with "?".`);
  res.items = kept.length;
  res.mermaid = lines.join('\n');
}

/**
 * Maps one axis to quadrantChart's 0..1 range. Values already in 0..1 are kept; 0..10 and 0..100 scores are divided
 * so their meaning stays (5 of 10 sits in the middle); anything else is min-max scaled into 0.05..0.95 so labels
 * on the smallest and largest points are not cut off at the edge.
 */
export function quadrantScale(vals: number[]): { f: (v: number) => number; how: string } {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo >= 0 && hi <= 1) return { f: v => v, how: '' };
  if (lo >= 0 && hi <= 10) return { f: v => v / 10, how: 'read as a 0 to 10 score and divided by 10' };
  if (lo >= 0 && hi <= 100) return { f: v => v / 100, how: 'read as a 0 to 100 score and divided by 100' };
  if (hi === lo) return { f: () => 0.5, how: 'put in the middle because it has only one value' };
  return {
    f: v => 0.05 + 0.9 * ((v - lo) / (hi - lo)),
    how: `rescaled from ${formatNumber(lo)}–${formatNumber(hi)} so the smallest value sits at 0.05 and the largest at 0.95`,
  };
}

function buildQuadrant(table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  if (!validCol(table, m.x) || !validCol(table, m.y)) { res.error = 'Choose the x and y columns.'; return; }
  if (m.x === m.y) res.notes.push('The x and y columns are the same, so every point lies on the diagonal.');
  let points: { name: string; x: number; y: number }[] = [];
  table.rows.forEach((r, ri) => {
    const x = parseNumber(r[m.x] ?? '', locale), y = parseNumber(r[m.y] ?? '', locale);
    if (x === null || y === null) { skip(res, ri + 1); return; }
    points.push({ name: clean(r[m.label] ?? '') || '(blank)', x, y });
  });
  if (!points.length) { res.error = 'No rows with numbers in both the x and y columns.'; return; }
  if (points.length > CAPS.quadrant) {
    res.notes.push(`Only the first ${CAPS.quadrant} of ${points.length} points are drawn.`);
    points = points.slice(0, CAPS.quadrant);
  }
  const sx = quadrantScale(points.map(p => p.x)), sy = quadrantScale(points.map(p => p.y));
  const how = sx.how && sx.how === sy.how ? `x and y were each ${sx.how}`
    : [sx.how ? `x was ${sx.how}` : '', sy.how ? `y was ${sy.how}` : ''].filter(Boolean).join(', and ');
  if (how) res.notes.push(`quadrantChart only accepts positions from 0 to 1, so ${how}.`);
  const lines = ['quadrantChart'];
  const title = rawText(o.title);
  if (title) lines.push(`    title ${title}`);
  const xName = clean(o.xTitle) || colName(table, m.x);
  const yName = clean(o.yTitle) || colName(table, m.y);
  lines.push(`    x-axis ${quoteLabel('Low ' + xName)} --> ${quoteLabel('High ' + xName)}`);
  lines.push(`    y-axis ${quoteLabel('Low ' + yName)} --> ${quoteLabel('High ' + yName)}`);
  o.quadrants.split(',').map(q => clean(q)).slice(0, 4).forEach((q, i) => { if (q) lines.push(`    quadrant-${i + 1} ${quoteLabel(q)}`); });
  const r3 = (v: number) => formatNumber(Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000);
  for (const p of points) lines.push(`    ${quoteLabel(p.name)}: [${r3(sx.f(p.x))}, ${r3(sy.f(p.y))}]`);
  res.items = points.length;
  res.mermaid = lines.join('\n');
}

function buildRadar(table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  const cols = seriesCols(table, m, res);
  if (!cols.length) { res.error = 'Choose one or more value columns (one curve each).'; return; }
  const raw = collect(table, m.label, cols, locale, res, v => v >= 0);
  if (raw.rejected) res.notes.push(`${raw.rejected} row${raw.rejected === 1 ? '' : 's'} with a negative value ${raw.rejected === 1 ? 'was' : 'were'} skipped; Mermaid's radar accepts 0 or more.`);
  const s = arrange(raw, 'radar', o, res);
  if (!s.labels.length) { res.error = 'No rows with numbers in the value columns.'; return; }
  if (s.labels.length < 3) res.notes.push('A radar reads best with three or more categories (rows).');
  const lines = ['radar-beta'];
  const title = rawText(o.title);
  if (title) lines.push(`    title ${title}`);
  lines.push(`    axis ${s.labels.map((l, i) => `a${i}[${quoteLabel(l)}]`).join(', ')}`);
  cols.forEach((c, k) => lines.push(`    curve c${k}[${quoteLabel(colName(table, c))}]{${s.values[k].map(formatNumber).join(', ')}}`));
  const dataMax = Math.max(...s.values.flat());
  const yMin = o.yMin !== null && o.yMin >= 0 ? o.yMin : 0;
  if (o.yMin !== null && o.yMin < 0) res.notes.push('The radar minimum must be 0 or more; 0 is used.');
  if (o.yMax !== null && o.yMax > yMin) {
    lines.push(`    max ${formatNumber(o.yMax)}`);
    if (dataMax > o.yMax) res.notes.push('Some values are larger than the maximum you set and are cut off.');
  } else if (o.yMax !== null) res.notes.push('The radar maximum must be larger than the minimum; it was ignored.');
  lines.push(`    min ${formatNumber(yMin)}`);
  res.items = s.labels.length;
  res.mermaid = lines.join('\n');
}

interface TreeNode { name: string; value: number; hasValue: boolean; children: Map<string, TreeNode> }

function detectSeparator(labels: string[]): string {
  for (const sep of ['/', '\\', '>', '|']) if (labels.filter(l => l.includes(sep)).length >= Math.max(1, labels.length * 0.3)) return sep;
  return '/';
}

function buildTreemap(table: ChartTable, m: ChartMapping, o: ChartOptions, locale: NumberLocale, res: ChartResult): void {
  const valueCol = m.values.find(c => validCol(table, c) && c !== m.label && c !== m.parent);
  if (valueCol === undefined) { res.error = 'Choose a value column (the size of each box).'; return; }
  const root: TreeNode = { name: '', value: 0, hasValue: false, children: new Map() };
  const node = (parent: TreeNode, name: string): TreeNode => {
    let n = parent.children.get(name);
    if (!n) { n = { name, value: 0, hasValue: false, children: new Map() }; parent.children.set(name, n); }
    return n;
  };
  const rows: { path: string[]; v: number }[] = [];
  let negatives = 0;
  const usePaths = !validCol(table, m.parent) || m.parent === m.label;
  const labels = table.rows.map(r => r[m.label] ?? '');
  const sep = o.separator || detectSeparator(labels);
  const parentOf = new Map<string, string>();
  table.rows.forEach((r, ri) => {
    // A parent link counts even on a row without a size (a group row such as "projects,home,").
    if (!usePaths) {
      const child = clean(r[m.label] ?? '') || '(blank)';
      const parent = clean(r[m.parent] ?? '');
      if (parent && parent !== child && !parentOf.has(child)) parentOf.set(child, parent);
    }
    const v = parseNumber(r[valueCol] ?? '', locale);
    if (v === null) { skip(res, ri + 1); return; }
    if (v < 0) { negatives++; return; }
    if (usePaths) {
      const path = (r[m.label] ?? '').split(sep).map(p => clean(p)).filter(Boolean);
      rows.push({ path: path.length ? path : ['(blank)'], v });
    } else {
      rows.push({ path: [clean(r[m.label] ?? '') || '(blank)'], v });
    }
  });
  if (negatives) res.notes.push(`${negatives} negative value${negatives === 1 ? ' was' : 's were'} skipped; a treemap cannot show them.`);
  if (!usePaths) {
    // Parent/child rows: walk up the parent chain to build the full path, stopping at loops.
    let loops = 0;
    for (const row of rows) {
      const path = [row.path[0]];
      const seen = new Set(path);
      let p = parentOf.get(path[0]);
      while (p) {
        if (seen.has(p)) { loops++; break; }
        seen.add(p);
        path.unshift(p);
        p = parentOf.get(p);
      }
      row.path = path;
    }
    if (loops) res.notes.push(`${loops} row${loops === 1 ? '' : 's'} had a parent chain that loops back; the loop was cut.`);
  }
  for (const r of rows) {
    let n = root;
    for (const part of r.path) n = node(n, part);
    n.value += r.v;
    n.hasValue = true;
  }
  let ignored = 0, count = 0, capped = false;
  const lines: string[] = ['treemap-beta'];
  const title = rawText(o.title);
  if (title) lines.push(`    title ${title}`);
  const walk = (n: TreeNode, depth: number) => {
    for (const c of n.children.values()) {
      if (count >= CAPS.treemap) { capped = true; return; }
      count++;
      const pad = '    '.repeat(depth);
      if (c.children.size) {
        if (c.hasValue) ignored++;
        lines.push(`${pad}${quoteLabel(c.name)}`);
        walk(c, depth + 1);
      } else {
        lines.push(`${pad}${quoteLabel(c.name)}: ${formatNumber(c.value)}`);
      }
    }
  };
  walk(root, 0);
  if (!count) { res.error = 'No rows with a number in the value column.'; return; }
  if (ignored) res.notes.push(`${ignored} row${ignored === 1 ? ' has' : 's have'} children as well as a value. Mermaid sizes a group by the sum of its children, so ${ignored === 1 ? 'that value was' : 'those values were'} not used.`);
  if (capped) res.notes.push(`Only the first ${CAPS.treemap} boxes are drawn.`);
  if (usePaths && rows.every(r => r.path.length === 1)) res.notes.push(`No "${sep}" was found in the labels, so all boxes are on one level. Use paths such as a${sep}b${sep}c or choose a parent column for groups.`);
  res.items = count;
  res.mermaid = lines.join('\n');
}

/** Builds the Mermaid source for one chart type. */
export function buildChart(type: ChartType, table: ChartTable, mapping: ChartMapping, options: Partial<ChartOptions> = {}, locale: NumberLocale = 'comma'): ChartResult {
  const o: ChartOptions = { ...DEFAULT_OPTIONS, ...options };
  const res = newResult();
  if (!validCol(table, mapping.label)) { res.error = 'Choose a label column.'; return res; }
  switch (type) {
    case 'pie': buildPie(table, mapping, o, locale, res); break;
    case 'bar': case 'hbar': case 'line': case 'barline': buildXy(type, table, mapping, o, locale, res); break;
    case 'sankey': buildSankey(table, mapping, o, locale, res); break;
    case 'quadrant': buildQuadrant(table, mapping, o, locale, res); break;
    case 'radar': buildRadar(table, mapping, o, locale, res); break;
    case 'treemap': buildTreemap(table, mapping, o, locale, res); break;
  }
  if (res.error) res.mermaid = '';
  return res;
}

/** One-line description of what was read and skipped, for the status line. */
export function statusLine(table: ChartTable, res: ChartResult): string {
  const n = table.rows.length;
  let s = `Read ${n} data row${n === 1 ? '' : 's'} and ${table.headers.length} column${table.headers.length === 1 ? '' : 's'} as ${FORMAT_NAMES[table.format]}${table.hasHeader ? ' with a header row' : ' without a header row'}.`;
  if (res.skippedCount) {
    const more = res.skippedCount > res.skippedRows.length ? ', …' : '';
    s += ` Skipped ${res.skippedCount} row${res.skippedCount === 1 ? '' : 's'} without a number: data row${res.skippedCount === 1 ? '' : 's'} ${res.skippedRows.join(', ')}${more}.`;
  }
  return s;
}
