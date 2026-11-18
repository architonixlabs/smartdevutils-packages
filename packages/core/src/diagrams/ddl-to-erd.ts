/** Result shape shared with the website's tools: `{ success, output, error?, metadata? }`. */
export interface DiagramResult {
  success: boolean;
  output: string;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export type ErdFormat = 'mermaid' | 'dbml';

interface Token {
  /** word: bare identifier/keyword; ident: quoted identifier; num; str; sym: any other single character. */
  t: 'word' | 'ident' | 'num' | 'str' | 'sym';
  v: string;
}

export interface ErdColumn { name: string; type: string; pk: boolean; fk: boolean; unique: boolean; notNull: boolean; increment: boolean }
export interface ErdForeignKey { columns: string[]; refTable: string[]; refColumns: string[] }
export interface ErdTable {
  schema: string;
  name: string;
  columns: ErdColumn[];
  primaryKey: string[];
  uniques: string[][];
  foreignKeys: ErdForeignKey[];
}

const WORD_START = /[A-Za-z_\u0080-￿]/;
const WORD_CHAR = /[A-Za-z0-9_$#@\u0080-￿]/;

/** SQL tokenizer: drops comments, keeps quoted identifiers ("x", `x`, [x]) apart from keywords. */
function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  const n = sql.length;
  let i = 0;
  const readQuoted = (close: string, doubling: boolean, backslash: boolean): string => {
    let v = '';
    i++; // opening quote
    while (i < n) {
      const c = sql[i];
      if (backslash && c === '\\' && i + 1 < n) { v += sql[i + 1]; i += 2; continue; }
      if (c === close) {
        if (doubling && sql[i + 1] === close) { v += close; i += 2; continue; }
        i++;
        return v;
      }
      v += c;
      i++;
    }
    return v; // unterminated: take the rest
  };
  while (i < n) {
    const c = sql[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '﻿') { i++; continue; }
    if (c === '-' && sql[i + 1] === '-') {
      const e = sql.indexOf('\n', i);
      i = e < 0 ? n : e;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const e = sql.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (c === "'") { out.push({ t: 'str', v: readQuoted("'", true, true) }); continue; }
    if (c === '"') { out.push({ t: 'ident', v: readQuoted('"', true, false) }); continue; }
    if (c === '`') { out.push({ t: 'ident', v: readQuoted('`', true, false) }); continue; }
    if (c === '[') {
      // [name] is a SQL Server identifier; integer[] / integer[3] directly after a word is an array suffix.
      const prev = i > 0 ? sql[i - 1] : ' ';
      const close = sql.indexOf(']', i + 1);
      const inner = close < 0 ? '' : sql.slice(i + 1, close);
      const arraySuffix = WORD_CHAR.test(prev) || prev === ')' || prev === ']';
      if (close > 0 && !arraySuffix && inner.length > 0 && !inner.includes('\n')) {
        out.push({ t: 'ident', v: readQuoted(']', true, false) });
        continue;
      }
      out.push({ t: 'sym', v: c });
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && /[0-9.]/.test(sql[j])) j++;
      out.push({ t: 'num', v: sql.slice(i, j) });
      i = j;
      continue;
    }
    if (WORD_START.test(c)) {
      let j = i + 1;
      while (j < n && WORD_CHAR.test(sql[j])) j++;
      out.push({ t: 'word', v: sql.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ t: 'sym', v: c });
    i++;
  }
  return out;
}

const isWord = (tok: Token | undefined, ...words: string[]): boolean =>
  !!tok && tok.t === 'word' && words.includes(tok.v.toUpperCase());
const isSym = (tok: Token | undefined, s: string): boolean => !!tok && tok.t === 'sym' && tok.v === s;
const isName = (tok: Token | undefined): tok is Token => !!tok && (tok.t === 'word' || tok.t === 'ident');

/** Words that end a column's data type. */
const TYPE_END = new Set([
  'NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'AUTO_INCREMENT', 'AUTOINCREMENT', 'IDENTITY',
  'GENERATED', 'COLLATE', 'COMMENT', 'ON', 'AS', 'KEY', 'ENCODE', 'SPARSE', 'ROWGUIDCOL', 'INVISIBLE', 'VISIBLE', 'STORAGE',
  'COMPRESSION', 'DEFERRABLE', 'INITIALLY', 'ENABLE', 'DISABLE', 'FOREIGN',
]);
const TABLE_CONSTRAINT_START = new Set(['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'EXCLUDE', 'LIKE', 'PERIOD', 'FULLTEXT', 'SPATIAL']);
const COMMON_TYPES = new Set([
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'BOOLEAN', 'BOOL', 'DATE', 'TIMESTAMP',
  'DATETIME', 'NUMERIC', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'UUID', 'JSON', 'JSONB', 'SERIAL', 'BIGSERIAL', 'BLOB', 'BYTEA', 'NUMBER',
  'VARCHAR2', 'BIT', 'MONEY', 'TIME', 'CLOB', 'MEDIUMTEXT', 'LONGTEXT',
]);

/** Splits a token list on top-level commas. */
function splitTopLevel(tokens: Token[]): Token[][] {
  const parts: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const tok of tokens) {
    if (isSym(tok, '(')) depth++;
    else if (isSym(tok, ')')) depth = Math.max(0, depth - 1);
    if (depth === 0 && isSym(tok, ',')) { parts.push(cur); cur = []; continue; }
    cur.push(tok);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** Index of the ")" matching the "(" at `open`, or tokens.length if it is never closed. */
function matchParen(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    if (isSym(tokens[i], '(')) depth++;
    else if (isSym(tokens[i], ')') && --depth === 0) return i;
  }
  return tokens.length;
}

/** Reads a (possibly qualified) name starting at `i`. */
function readName(tokens: Token[], i: number): { parts: string[]; next: number } {
  const parts: string[] = [];
  while (isName(tokens[i])) {
    parts.push(tokens[i].v);
    if (isSym(tokens[i + 1], '.') && isName(tokens[i + 2])) { i += 2; continue; }
    i++;
    break;
  }
  return { parts, next: i };
}

/** Reads "(a, b DESC, c(10))" at `i` → ['a','b','c']. */
function readColumnList(tokens: Token[], i: number): { columns: string[]; next: number } {
  if (!isSym(tokens[i], '(')) return { columns: [], next: i };
  const close = matchParen(tokens, i);
  const columns = splitTopLevel(tokens.slice(i + 1, close)).map(p => p[0]).filter(isName).map(t => t.v);
  return { columns, next: close + 1 };
}

function stringifyType(tokens: Token[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const v = tok.t === 'str' ? `'${tok.v}'` : tok.v;
    const prev = tokens[i - 1];
    const glue = !prev || tok.t === 'sym' || (prev.t === 'sym' && prev.v !== ')' && prev.v !== ']') ? '' : ' ';
    out += glue + v;
  }
  return out;
}

/** Finds the table a foreign key points to in `tables`, preferring the same schema as the referencing table. */
export function resolveForeignKey(tables: ErdTable[], fk: ErdForeignKey, from: ErdTable): ErdTable | undefined {
  const name = fk.refTable[fk.refTable.length - 1]?.toLowerCase();
  const sameName = tables.filter(t => t.name.toLowerCase() === name);
  if (fk.refTable.length > 1) {
    const schema = fk.refTable[fk.refTable.length - 2].toLowerCase();
    return (schema && sameName.find(t => t.schema.toLowerCase() === schema)) || sameName[0];
  }
  return sameName.find(t => t.schema.toLowerCase() === from.schema.toLowerCase()) ?? sameName[0];
}

class Parser {
  readonly tables: ErdTable[] = [];
  readonly warnings: string[] = [];

  parse(sql: string): void {
    const tokens = tokenize(sql);
    // statements end at a top-level ";" (or a SQL Server "GO" line)
    let cur: Token[] = [];
    let depth = 0;
    const flush = () => { if (cur.length) this.statement(cur); cur = []; depth = 0; };
    for (const tok of tokens) {
      if (isSym(tok, '(')) depth++;
      else if (isSym(tok, ')')) depth = Math.max(0, depth - 1);
      if (depth === 0 && (isSym(tok, ';') || (isWord(tok, 'GO') && tok.v === tok.v.toUpperCase()))) { flush(); continue; }
      cur.push(tok);
    }
    flush();
  }

  private find(parts: string[]): ErdTable | undefined {
    const name = parts[parts.length - 1]?.toLowerCase();
    const schema = parts.length > 1 ? parts[parts.length - 2].toLowerCase() : '';
    const sameName = this.tables.filter(t => t.name.toLowerCase() === name);
    return (schema && sameName.find(t => t.schema.toLowerCase() === schema)) || sameName[0];
  }

  /** Resolves a foreign key target, preferring the same schema as the referencing table. */
  resolve(fk: ErdForeignKey, from: ErdTable): ErdTable | undefined {
    return resolveForeignKey(this.tables, fk, from);
  }

  private statement(tokens: Token[]): void {
    let i = 0;
    if (isWord(tokens[0], 'CREATE')) {
      i = 1;
      while (isWord(tokens[i], 'OR', 'REPLACE', 'GLOBAL', 'LOCAL', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'EXTERNAL', 'TRANSIENT', 'VOLATILE', 'COLUMN', 'ROW', 'MEMORY', 'CACHED')) i++;
      if (isWord(tokens[i], 'TABLE')) return this.createTable(tokens, i + 1);
      if (isWord(tokens[i], 'UNIQUE')) return this.createUniqueIndex(tokens, i + 1);
      return;
    }
    if (isWord(tokens[0], 'ALTER') && isWord(tokens[1], 'TABLE')) this.alterTable(tokens, 2);
  }

  private createTable(tokens: Token[], i: number): void {
    if (isWord(tokens[i], 'IF') && isWord(tokens[i + 1], 'NOT') && isWord(tokens[i + 2], 'EXISTS')) i += 3;
    const { parts, next } = readName(tokens, i);
    if (!parts.length) return;
    if (!isSym(tokens[next], '(')) {
      // CREATE TABLE x AS SELECT …, PARTITION OF …: no column list to read
      this.warnings.push(`Skipped ${parts.join('.')}: no column list.`);
      return;
    }
    const table: ErdTable = {
      schema: parts.length > 1 ? parts[parts.length - 2] : '', name: parts[parts.length - 1],
      columns: [], primaryKey: [], uniques: [], foreignKeys: [],
    };
    const close = matchParen(tokens, next);
    for (const item of splitTopLevel(tokens.slice(next + 1, close))) {
      if (!item.length) continue;
      if (this.isTableConstraint(item)) this.constraint(table, item, 0);
      else this.column(table, item);
    }
    this.finish(table);
    this.tables.push(table);
  }

  private isTableConstraint(item: Token[]): boolean {
    const first = item[0];
    if (first.t !== 'word') return false;
    const w = first.v.toUpperCase();
    if (TABLE_CONSTRAINT_START.has(w)) {
      // a column may be called e.g. "check" or "period": then a type follows instead of "(" / KEY
      return !(item[1]?.t === 'word' && COMMON_TYPES.has(item[1].v.toUpperCase()));
    }
    if (w === 'KEY' || w === 'INDEX') return !(item[1]?.t === 'word' && COMMON_TYPES.has(item[1].v.toUpperCase()));
    return false;
  }

  private column(table: ErdTable, item: Token[]): void {
    if (!isName(item[0])) return;
    const col: ErdColumn = { name: item[0].v, type: '', pk: false, fk: false, unique: false, notNull: false, increment: false };
    // data type: everything up to the first constraint keyword
    let i = 1;
    const typeTokens: Token[] = [];
    while (i < item.length) {
      const tok = item[i];
      if (tok.t === 'word' && TYPE_END.has(tok.v.toUpperCase())) break;
      // MySQL "CHARACTER SET x" / "CHARSET x" (but "character varying" is a type)
      if (isWord(tok, 'CHARSET') || (isWord(tok, 'CHARACTER') && isWord(item[i + 1], 'SET'))) break;
      if (isSym(tok, '(')) {
        const close = matchParen(item, i);
        typeTokens.push(...item.slice(i, close + 1));
        i = close + 1;
        continue;
      }
      typeTokens.push(tok);
      i++;
    }
    col.type = stringifyType(typeTokens);
    if (/^(big|small)?serial\d?$/i.test(col.type)) col.increment = true;
    // constraints: skip parenthesised expressions so their contents are never read as keywords
    while (i < item.length) {
      const tok = item[i];
      if (isSym(tok, '(')) { i = matchParen(item, i) + 1; continue; }
      if (isWord(tok, 'PRIMARY') && isWord(item[i + 1], 'KEY')) { col.pk = true; i += 2; continue; }
      if (isWord(tok, 'UNIQUE')) { col.unique = true; i++; continue; }
      if (isWord(tok, 'NOT') && isWord(item[i + 1], 'NULL')) { col.notNull = true; i += 2; continue; }
      if (isWord(tok, 'AUTO_INCREMENT', 'AUTOINCREMENT', 'IDENTITY')) { col.increment = true; i++; continue; }
      if (isWord(tok, 'REFERENCES')) {
        const ref = readName(item, i + 1);
        const cols = readColumnList(item, ref.next);
        if (ref.parts.length) table.foreignKeys.push({ columns: [col.name], refTable: ref.parts, refColumns: cols.columns });
        i = cols.next;
        continue;
      }
      i++;
    }
    if (col.pk && !table.primaryKey.includes(col.name)) table.primaryKey.push(col.name);
    if (col.unique) table.uniques.push([col.name]);
    table.columns.push(col);
  }

  /** Parses [CONSTRAINT name] PRIMARY KEY | UNIQUE | FOREIGN KEY … starting at `i`. */
  private constraint(table: ErdTable, item: Token[], i: number): void {
    if (isWord(item[i], 'CONSTRAINT')) {
      i++;
      if (isName(item[i]) && !isWord(item[i], 'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK')) i++;
    }
    const toParen = (from: number): number => {
      let j = from;
      while (j < item.length && !isSym(item[j], '(')) j++;
      return j;
    };
    if (isWord(item[i], 'PRIMARY') && isWord(item[i + 1], 'KEY')) {
      const { columns } = readColumnList(item, toParen(i + 2));
      for (const c of columns) if (!table.primaryKey.some(p => p.toLowerCase() === c.toLowerCase())) table.primaryKey.push(c);
      return;
    }
    if (isWord(item[i], 'UNIQUE')) {
      const { columns } = readColumnList(item, toParen(i + 1));
      if (columns.length) table.uniques.push(columns);
      return;
    }
    if (isWord(item[i], 'FOREIGN') && isWord(item[i + 1], 'KEY')) {
      const local = readColumnList(item, toParen(i + 2));
      let j = local.next;
      while (j < item.length && !isWord(item[j], 'REFERENCES')) j++;
      if (j >= item.length) return;
      const ref = readName(item, j + 1);
      const cols = readColumnList(item, ref.next);
      if (ref.parts.length && local.columns.length) {
        table.foreignKeys.push({ columns: local.columns, refTable: ref.parts, refColumns: cols.columns });
      }
    }
  }

  /** Applies table-level keys to the column flags. */
  private finish(table: ErdTable): void {
    const byName = new Map(table.columns.map(c => [c.name.toLowerCase(), c]));
    for (const c of table.columns) { c.pk = false; c.fk = false; c.unique = false; }
    for (const p of table.primaryKey) { const c = byName.get(p.toLowerCase()); if (c) { c.pk = true; c.notNull = true; } }
    for (const u of table.uniques) if (u.length === 1) { const c = byName.get(u[0].toLowerCase()); if (c) c.unique = true; }
    for (const fk of table.foreignKeys) for (const name of fk.columns) { const c = byName.get(name.toLowerCase()); if (c) c.fk = true; }
  }

  private alterTable(tokens: Token[], i: number): void {
    if (isWord(tokens[i], 'IF') && isWord(tokens[i + 1], 'EXISTS')) i += 2;
    if (isWord(tokens[i], 'ONLY')) i++;
    const { parts, next } = readName(tokens, i);
    const table = this.find(parts);
    if (!table) {
      if (parts.length) this.warnings.push(`ALTER TABLE ${parts.join('.')}: table is not defined in the input, statement skipped.`);
      return;
    }
    for (const action of splitTopLevel(tokens.slice(next))) {
      let j = 0;
      if (isWord(action[j], 'WITH') && isWord(action[j + 1], 'CHECK', 'NOCHECK')) j += 2; // SQL Server
      if (!isWord(action[j], 'ADD')) continue;
      j++;
      if (isWord(action[j], 'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE')) this.constraint(table, action, j);
      else if (isWord(action[j], 'COLUMN') || isName(action[j])) {
        if (isWord(action[j], 'COLUMN')) j++;
        if (isWord(action[j], 'IF') && isWord(action[j + 1], 'NOT') && isWord(action[j + 2], 'EXISTS')) j += 3;
        this.column(table, action.slice(j));
      }
    }
    this.finish(table);
  }

  private createUniqueIndex(tokens: Token[], i: number): void {
    while (i < tokens.length && !isWord(tokens[i], 'ON')) i++;
    if (i >= tokens.length) return;
    const { parts, next } = readName(tokens, isWord(tokens[i + 1], 'ONLY') ? i + 2 : i + 1);
    const table = this.find(parts);
    if (!table) return;
    let j = next;
    while (j < tokens.length && !isSym(tokens[j], '(')) j++;
    const { columns } = readColumnList(tokens, j);
    if (columns.length && columns.every(c => table.columns.some(tc => tc.name.toLowerCase() === c.toLowerCase()))) {
      table.uniques.push(columns);
      this.finish(table);
    }
  }
}

/* ── Rendering ───────────────────────────────────────────────────────────────────────────────── */

/** Mermaid entity / attribute name: letters, digits and underscores only, never starting with a digit. */
export function mermaidId(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  let id = name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_');
  if (id.startsWith('_')) id = id.slice(1);
  if (id.endsWith('_')) id = id.slice(0, -1);
  if (!id) id = 'unnamed';
  if (/^[0-9]/.test(id)) id = `_${id}`;
  return id;
}

/** Mermaid attribute type: one word. Commas and spaces are not allowed, so numeric(10,2) becomes numeric(10_2). */
export function mermaidType(type: string): string {
  let t = type.trim().replace(/\s+/g, ' ').replace(/ ?, ?/g, '_').replace(/ /g, '_').replace(/[^A-Za-z0-9_()[\]-]/g, '');
  if (!t) t = 'unknown';
  if (!/^[A-Za-z_]/.test(t)) t = `_${t}`;
  return t;
}

export function uniqueIds(names: string[], make: (s: string) => string): string[] {
  const used = new Set<string>();
  return names.map(n => {
    const base = make(n);
    let id = base, k = 2;
    while (used.has(id.toLowerCase())) id = `${base}_${k++}`;
    used.add(id.toLowerCase());
    return id;
  });
}

function dbmlName(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, "'").replace(/[\r\n]+/g, ' ')}"`;
}
function dbmlType(type: string): string {
  const t = (type.trim() || 'unknown').replace(/\s+/g, ' ').replace(/ ?, ?/g, ',');
  if (/^[A-Za-z_][A-Za-z0-9_]*(\([A-Za-z0-9_,]*\))?$/.test(t)) return t;
  return `"${t.replace(/"/g, "'").replace(/[\r\n]+/g, ' ')}"`;
}

/** DDL to ERD converter (plain class; the website wraps the same code in an Angular service). */
export class DdlToErdService {
  /** Parses the DDL into tables (exposed for tests). */
  parse(input: string): { tables: ErdTable[]; warnings: string[] } {
    const p = new Parser();
    p.parse(input);
    return { tables: p.tables, warnings: p.warnings };
  }

  convert(input: string, format: ErdFormat = 'mermaid'): DiagramResult {
    if (!input.trim()) return { success: true, output: '' };
    const parser = new Parser();
    parser.parse(input);
    if (!parser.tables.length) {
      return { success: false, output: '', error: 'No CREATE TABLE statement with a column list was found.' };
    }
    const output = format === 'dbml' ? this.dbml(parser) : this.mermaid(parser);
    const relationships = parser.tables.reduce((n, t) => n + t.foreignKeys.length, 0);
    return { success: true, output, metadata: { tables: parser.tables.length, relationships, warnings: parser.warnings } };
  }

  private mermaid(parser: Parser): string {
    const tables = parser.tables;
    const nameCount = new Map<string, number>();
    for (const t of tables) nameCount.set(t.name.toLowerCase(), (nameCount.get(t.name.toLowerCase()) ?? 0) + 1);
    // the bare table name, unless two schemas share it
    const ids = uniqueIds(tables.map(t => (t.schema && nameCount.get(t.name.toLowerCase())! > 1 ? `${t.schema}_${t.name}` : t.name)), mermaidId);
    const idOf = new Map(tables.map((t, i) => [t, ids[i]]));
    const lines = ['erDiagram'];
    for (const t of tables) {
      const colIds = uniqueIds(t.columns.map(c => c.name), mermaidId);
      if (!t.columns.length) { lines.push(`    ${idOf.get(t)} {`, '    }'); continue; }
      lines.push(`    ${idOf.get(t)} {`);
      t.columns.forEach((c, i) => {
        const keys = [c.pk ? 'PK' : '', c.fk ? 'FK' : '', c.unique && !c.pk ? 'UK' : ''].filter(Boolean).join(', ');
        lines.push(`        ${mermaidType(c.type)} ${colIds[i]}${keys ? ' ' + keys : ''}`);
      });
      lines.push('    }');
    }
    const rels: string[] = [];
    for (const t of tables) {
      for (const fk of t.foreignKeys) {
        const target = parser.resolve(fk, t);
        const targetId = target ? idOf.get(target)! : mermaidId(fk.refTable[fk.refTable.length - 1]);
        const cols = fk.columns.map(n => t.columns.find(c => c.name.toLowerCase() === n.toLowerCase()));
        const optional = cols.some(c => !c || !c.notNull);
        const lower = fk.columns.map(c => c.toLowerCase()).sort().join('\u0000');
        const isUnique =
          t.uniques.some(u => u.map(c => c.toLowerCase()).sort().join('\u0000') === lower) ||
          t.primaryKey.map(c => c.toLowerCase()).sort().join('\u0000') === lower;
        // child side: many (or at most one when the FK columns are unique); parent side: exactly one, or zero-or-one for a nullable FK
        const card = `${isUnique ? '|o' : '}o'}--${optional ? 'o|' : '||'}`;
        const label = fk.columns.map(mermaidId).join(', ');
        rels.push(`    ${idOf.get(t)} ${card} ${targetId} : "${label}"`);
      }
    }
    return [...lines, ...rels].join('\n') + '\n';
  }

  private dbml(parser: Parser): string {
    const blocks: string[] = [];
    const refs: string[] = [];
    const full = (t: { schema: string; name: string }) => (t.schema ? `${dbmlName(t.schema)}.` : '') + dbmlName(t.name);
    for (const t of parser.tables) {
      const lines = t.columns.map(c => {
        const settings = [
          c.pk && t.primaryKey.length === 1 ? 'pk' : '',
          c.increment ? 'increment' : '',
          c.unique && !(c.pk && t.primaryKey.length === 1) ? 'unique' : '',
          c.notNull && !(c.pk && t.primaryKey.length === 1) ? 'not null' : '',
        ].filter(Boolean);
        return `  ${dbmlName(c.name)} ${dbmlType(c.type)}${settings.length ? ` [${settings.join(', ')}]` : ''}`;
      });
      const indexes: string[] = [];
      if (t.primaryKey.length > 1) indexes.push(`    (${t.primaryKey.map(dbmlName).join(', ')}) [pk]`);
      for (const u of t.uniques) if (u.length > 1) indexes.push(`    (${u.map(dbmlName).join(', ')}) [unique]`);
      if (indexes.length) lines.push('', '  indexes {', ...indexes, '  }');
      blocks.push(`Table ${full(t)} {\n${lines.join('\n')}\n}`);

      for (const fk of t.foreignKeys) {
        const target = parser.resolve(fk, t);
        let refCols = fk.refColumns;
        if (!refCols.length && target && target.primaryKey.length === fk.columns.length) refCols = target.primaryKey;
        if (refCols.length !== fk.columns.length) {
          parser.warnings.push(`${t.name}(${fk.columns.join(', ')}) → ${fk.refTable.join('.')}: referenced columns are unknown, Ref omitted from DBML.`);
          continue;
        }
        const targetName = target
          ? full(target)
          : fk.refTable.slice(-2).map(dbmlName).join('.');
        const side = (cols: string[]) => (cols.length === 1 ? dbmlName(cols[0]) : `(${cols.map(dbmlName).join(', ')})`);
        refs.push(`Ref: ${full(t)}.${side(fk.columns)} > ${targetName}.${side(refCols)}`);
      }
    }
    return blocks.join('\n\n') + (refs.length ? '\n\n' + refs.join('\n') : '') + '\n';
  }
}

const defaultService = new DdlToErdService();

/** Parses `CREATE TABLE` DDL into tables, plus warnings for anything skipped. */
export function parseDdl(input: string): { tables: ErdTable[]; warnings: string[] } {
  return defaultService.parse(input);
}

/** Converts `CREATE TABLE` DDL to a Mermaid `erDiagram` (default) or DBML. */
export function ddlToErd(input: string, format: ErdFormat = 'mermaid'): DiagramResult {
  return defaultService.convert(input, format);
}
