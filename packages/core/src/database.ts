export interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
  /** generateCreateTable: set false to stop an integer primary key from auto-incrementing (default true). */
  autoIncrement?: boolean;
  /** diffDdlStatements: table the column belongs to (unquoted name). */
  table?: string;
  /** diffDdlStatements: everything after the column name (type + inline constraints), whitespace-normalised. */
  definition?: string;
  /** diffDdlStatements: the identifier exactly as written, including quotes. */
  rawName?: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnDef[];
}

export interface DdlDiff {
  added: ColumnDef[];
  removed: ColumnDef[];
  /** `before` / `after` are the full column definitions (type + inline constraints). */
  changed: { name: string; before: string; after: string; table?: string; beforeColumn?: ColumnDef; afterColumn?: ColumnDef }[];
  /** Tables present only in `after`. */
  addedTables?: string[];
  /** Tables present only in `before`. */
  removedTables?: string[];
}

export interface SlowQueryPattern {
  pattern: string;
  severity: 'error' | 'warning' | 'info';
  explanation: string;
  suggestion: string;
}

export interface IndexSuggestion {
  /** Column name, or a comma-separated list for a composite index. */
  column: string;
  reason: string;
  sql: string;
  /** Real table name (aliases resolved). */
  table?: string;
  /** Index columns in order. */
  columns?: string[];
}

export interface MigrationSql {
  up: string;
  down: string;
  /** Possible-rename and manual-review warnings (also emitted as `-- WARNING` comments in `up`). */
  warnings?: string[];
  /** false when the two schemas are equivalent. */
  hasChanges?: boolean;
}

export interface CreateTableOptions {
  /** Postgres `UUID` / MSSQL `UNIQUEIDENTIFIER` primary keys get a generated default. */
  uuidDefault?: boolean;
}

type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

// ---------------------------------------------------------------------------
// SQL tokenizer (shared). Comments are dropped; string literals become 'str' tokens.
// ---------------------------------------------------------------------------

interface Tok {
  t: 'id' | 'qid' | 'str' | 'num' | 'op' | 'param' | '(' | ')' | ',' | '.' | ';';
  /** identifier text (unquoted), string content, or the raw token. */
  v: string;
  raw: string;
  start: number;
  end: number;
  /** whitespace or a comment precedes this token */
  ws: boolean;
}

const MULTI_OPS = ['->>', '<=>', '::', '<=', '>=', '<>', '!=', '||', '->', '=>'];

function tokenize(sql: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let ws = false;
  const n = sql.length;
  const push = (t: Tok['t'], v: string, start: number, end: number) => {
    toks.push({ t, v, raw: sql.slice(start, end), start, end, ws });
    ws = false;
  };
  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) { ws = true; i++; continue; }
    if (c === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++;
      ws = true; continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      ws = true; continue;
    }
    const start = i;
    // string literal, with optional E/N/B/X prefix
    if (c === "'" || (/[eEnNbBxX]/.test(c) && sql[i + 1] === "'" && !/[\w$]/.test(sql[i - 1] ?? ''))) {
      if (c !== "'") i++;
      i++;
      let v = '';
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (sql[i] === '\\' && /[eE]/.test(c) && i + 1 < n) { v += sql[i + 1]; i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        v += sql[i++];
      }
      push('str', v, start, i);
      continue;
    }
    // Postgres dollar-quoted string
    if (c === '$') {
      const tag = /^\$([A-Za-z_]\w*)?\$/.exec(sql.slice(i));
      if (tag) {
        const close = sql.indexOf(tag[0], i + tag[0].length);
        const endPos = close === -1 ? n : close + tag[0].length;
        push('str', sql.slice(i + tag[0].length, close === -1 ? n : close), start, endPos);
        i = endPos; continue;
      }
      const num = /^\$\d+/.exec(sql.slice(i));
      if (num) { i += num[0].length; push('param', num[0], start, i); continue; }
    }
    // quoted identifiers
    if (c === '"' || c === '`' || c === '[') {
      const close = c === '[' ? ']' : c;
      i++;
      let v = '';
      while (i < n) {
        if (sql[i] === close && sql[i + 1] === close) { v += close; i += 2; continue; }
        if (sql[i] === close) { i++; break; }
        v += sql[i++];
      }
      push('qid', v, start, i);
      continue;
    }
    if (/\d/.test(c) || (c === '.' && /\d/.test(sql[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(sql.slice(i));
      i += m ? m[0].length : 1;
      push('num', sql.slice(start, i), start, i);
      continue;
    }
    const identChar = (ch: string) => /[\w$]/.test(ch) || ch.charCodeAt(0) > 0x7f;
    if (/[A-Za-z_]/.test(c) || c.charCodeAt(0) > 0x7f) {
      while (i < n && identChar(sql[i])) i++;
      push('id', sql.slice(start, i), start, i);
      continue;
    }
    if (c === '?' ) { i++; push('param', '?', start, i); continue; }
    if ((c === ':' || c === '@') && /[A-Za-z_]/.test(sql[i + 1] ?? '') && sql[i - 1] !== ':') {
      i++;
      while (i < n && /\w/.test(sql[i])) i++;
      push('param', sql.slice(start, i), start, i);
      continue;
    }
    if (c === '(' || c === ')' || c === ',' || c === '.' || c === ';') { i++; push(c, c, start, i); continue; }
    const op = MULTI_OPS.find(o => sql.startsWith(o, i)) ?? c;
    i += op.length;
    push('op', op, start, i);
  }
  return toks;
}

const isKw = (t: Tok | undefined, ...words: string[]) => !!t && t.t === 'id' && words.includes(t.v.toUpperCase());
const isIdent = (t: Tok | undefined) => !!t && (t.t === 'id' || t.t === 'qid');

/** Joins tokens back into text, collapsing any whitespace/comments between them to one space. */
function joinToks(toks: Tok[]): string {
  return toks.map((t, i) => (i > 0 && t.ws ? ' ' : '') + t.raw).join('');
}

/** Index of the ')' matching the '(' at `open`, or toks.length. */
function matchParen(toks: Tok[], open: number): number {
  let depth = 0;
  for (let i = open; i < toks.length; i++) {
    if (toks[i].t === '(') depth++;
    else if (toks[i].t === ')' && --depth === 0) return i;
  }
  return toks.length;
}

/** Splits tokens on `sep` tokens at paren depth 0. */
function splitTop(toks: Tok[], sep: ',' | ';'): Tok[][] {
  const out: Tok[][] = [];
  let cur: Tok[] = [];
  let depth = 0;
  for (const t of toks) {
    if (t.t === '(') depth++;
    else if (t.t === ')') depth--;
    if (t.t === sep && depth === 0) { out.push(cur); cur = []; continue; }
    cur.push(t);
  }
  out.push(cur);
  return out.filter(p => p.length > 0);
}

/** Comparison key: double-quoted identifiers are case-sensitive, everything else folds to lower case. */
function identKey(t: Tok): string {
  return t.t === 'qid' && t.raw.startsWith('"') ? t.v : t.v.toLowerCase();
}

// ---------------------------------------------------------------------------
// generateCreateTable
// ---------------------------------------------------------------------------

const RESERVED_WORDS = new Set([
  'all', 'alter', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'between', 'both', 'by', 'case', 'cast',
  'check', 'collate', 'column', 'constraint', 'create', 'cross', 'current_date', 'current_time', 'current_timestamp',
  'current_user', 'database', 'default', 'delete', 'desc', 'distinct', 'drop', 'else', 'end', 'except', 'exists',
  'false', 'fetch', 'for', 'foreign', 'from', 'full', 'grant', 'group', 'having', 'in', 'index', 'inner', 'insert',
  'intersect', 'into', 'is', 'join', 'key', 'leading', 'left', 'like', 'limit', 'natural', 'not', 'null', 'offset',
  'on', 'or', 'order', 'outer', 'primary', 'references', 'right', 'rows', 'select', 'session_user', 'set', 'table',
  'then', 'to', 'top', 'trailing', 'true', 'union', 'unique', 'update', 'user', 'using', 'values', 'when', 'where',
  'window', 'with',
]);

function quoteIdent(name: string, dialect: Dialect): string {
  if (/^["`[]/.test(name)) return name;
  if (/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name) && !RESERVED_WORDS.has(name.toLowerCase())) return name;
  if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`';
  if (dialect === 'mssql') return '[' + name.replace(/]/g, ']]') + ']';
  return '"' + name.replace(/"/g, '""') + '"';
}

function quoteQualified(name: string, dialect: Dialect): string {
  if (/^["`[]/.test(name)) return name;
  return name.split('.').map(p => quoteIdent(p, dialect)).join('.');
}

const SQL_DEFAULT_KEYWORDS = /^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|LOCALTIMESTAMP|LOCALTIME|CURRENT_USER|SESSION_USER|SYSDATE|SYSTIMESTAMP|UNIX_TIMESTAMP)$/i;

function formatDefault(value: string, dialect: Dialect): string {
  const v = value.trim();
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) return v;
  if (/^(true|false)$/i.test(v)) return dialect === 'mssql' ? (v.toLowerCase() === 'true' ? '1' : '0') : v;
  if (SQL_DEFAULT_KEYWORDS.test(v)) return v;
  if (/^[EeNnBbXx]?'/.test(v)) return v; // already a literal (incl. 'x'::type casts)
  if (/^\(.*\)$/s.test(v)) return v; // parenthesised expression
  if (/^[A-Za-z_][\w.]*\s*\(.*\)$/s.test(v)) return v; // function call: now(), gen_random_uuid(), nextval('s')
  return `'${v.replace(/'/g, "''")}'`;
}

const INTEGER_TYPE = /^((tiny|small|medium|big)?int(eger)?|int[248]|(small|big)?serial)\b/i;

/**
 * Builds a CREATE TABLE statement. Only integer primary keys auto-increment (SERIAL / AUTO_INCREMENT /
 * IDENTITY / AUTOINCREMENT); string defaults are quoted; reserved-word identifiers are quoted per dialect.
 */
export function generateCreateTable(schema: TableSchema, dialect: Dialect, options: CreateTableOptions = {}): string {
  const cols = schema.columns.map(col => {
    let type = col.type;
    let extra = '';
    let def = col.defaultValue ? ` DEFAULT ${formatDefault(col.defaultValue, dialect)}` : '';
    if (col.primaryKey) {
      const auto = INTEGER_TYPE.test(col.type.trim()) && col.autoIncrement !== false;
      extra = ' PRIMARY KEY';
      if (auto) {
        if (dialect === 'postgres') {
          type = /^(big|int8)/i.test(col.type.trim()) ? 'BIGSERIAL' : /^(small|int2)/i.test(col.type.trim()) ? 'SMALLSERIAL' : 'SERIAL';
        } else if (dialect === 'mysql') { extra = ' AUTO_INCREMENT PRIMARY KEY'; }
        else if (dialect === 'sqlite') { type = 'INTEGER'; extra = ' PRIMARY KEY AUTOINCREMENT'; }
        else if (dialect === 'mssql') { extra = ' IDENTITY(1,1) PRIMARY KEY'; }
      } else if (options.uuidDefault && !def) {
        if (dialect === 'postgres' && /^uuid$/i.test(col.type.trim())) def = ' DEFAULT gen_random_uuid()';
        else if (dialect === 'mssql' && /^uniqueidentifier$/i.test(col.type.trim())) def = ' DEFAULT NEWID()';
      }
    }
    const nullStr = col.nullable === false && !col.primaryKey ? ' NOT NULL' : '';
    return `  ${quoteIdent(col.name, dialect)} ${type}${extra}${nullStr}${def}`;
  });
  return `CREATE TABLE ${quoteQualified(schema.tableName, dialect)} (\n${cols.join(',\n')}\n);`;
}

// ---------------------------------------------------------------------------
// DDL parsing
// ---------------------------------------------------------------------------

interface ParsedColumn extends ColumnDef {
  key: string;
  rawName: string;
  definition: string;
  /** upper-cased definition (string literals kept verbatim) for comparison */
  cmp: string;
  notNull: boolean;
  /** definition tokens with PRIMARY KEY / UNIQUE [KEY] removed (for MySQL MODIFY) */
  modifyDef: string;
  /** constraints other than NULL / NOT NULL / DEFAULT, upper-cased, for comparison */
  extra: string;
  unique: boolean;
}

interface ParsedTable {
  key: string;
  name: string;
  rawName: string;
  statement: string;
  columns: ParsedColumn[];
}

const TABLE_CONSTRAINT_START = new Set(['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'UNIQUE', 'INDEX', 'KEY', 'FULLTEXT', 'SPATIAL', 'EXCLUDE', 'PERIOD', 'LIKE']);
const COLUMN_CONSTRAINT_START = new Set([
  'NOT', 'NULL', 'DEFAULT', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'AUTO_INCREMENT', 'AUTOINCREMENT',
  'IDENTITY', 'GENERATED', 'COLLATE', 'COMMENT', 'ON', 'AS', 'KEY', 'CHARSET', 'STORED', 'VIRTUAL', 'INVISIBLE', 'VISIBLE',
  'SPARSE', 'ROWGUIDCOL',
]);

function upperCmp(toks: Tok[]): string {
  return toks.map((t, i) => (i > 0 && t.ws ? ' ' : '') + (t.t === 'str' || (t.t === 'qid' && t.raw.startsWith('"')) ? t.raw : t.raw.toUpperCase())).join('');
}

function parseColumnItem(item: Tok[], table: string): ParsedColumn | null {
  const first = item[0];
  if (!isIdent(first)) return null;
  if (first.t === 'id' && TABLE_CONSTRAINT_START.has(first.v.toUpperCase())) return null;
  const rest = item.slice(1);
  // type = tokens up to the first column-constraint keyword at depth 0
  let depth = 0;
  let typeEnd = rest.length;
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.t === '(') depth++;
    else if (t.t === ')') depth--;
    else if (depth === 0 && i > 0 && t.t === 'id') {
      const u = t.v.toUpperCase();
      if (COLUMN_CONSTRAINT_START.has(u) || (u === 'CHARACTER' && isKw(rest[i + 1], 'SET'))) { typeEnd = i; break; }
    }
  }
  const constraintToks = rest.slice(typeEnd);
  let notNull = false;
  let explicitNull = false;
  let primaryKey = false;
  let unique = false;
  let defaultValue: string | undefined;
  const modifyToks: Tok[] = [];
  const extraToks: Tok[] = [];
  for (let i = 0; i < constraintToks.length; i++) {
    const t = constraintToks[i];
    if (isKw(t, 'NOT') && isKw(constraintToks[i + 1], 'NULL')) { notNull = true; modifyToks.push(t, constraintToks[++i]); continue; }
    if (isKw(t, 'NULL')) { explicitNull = true; modifyToks.push(t); continue; }
    if (isKw(t, 'PRIMARY') && isKw(constraintToks[i + 1], 'KEY')) { primaryKey = true; extraToks.push(t, constraintToks[++i]); continue; }
    if (isKw(t, 'UNIQUE')) { unique = true; extraToks.push(t); if (isKw(constraintToks[i + 1], 'KEY')) extraToks.push(constraintToks[++i]); continue; }
    if (isKw(t, 'DEFAULT')) {
      let j = i + 1;
      let d = 0;
      for (; j < constraintToks.length; j++) {
        const x = constraintToks[j];
        if (x.t === '(') d++;
        else if (x.t === ')') d--;
        else if (d === 0 && j > i + 1 && x.t === 'id' && COLUMN_CONSTRAINT_START.has(x.v.toUpperCase())) break;
      }
      defaultValue = joinToks(constraintToks.slice(i + 1, j));
      modifyToks.push(...constraintToks.slice(i, j));
      i = j - 1;
      continue;
    }
    modifyToks.push(t);
    extraToks.push(t);
  }
  const typeToks = rest.slice(0, typeEnd);
  const typeStr = joinToks(typeToks);
  return {
    name: first.v,
    rawName: first.raw,
    key: identKey(first),
    type: typeStr,
    table,
    definition: joinToks(rest),
    cmp: upperCmp(rest),
    notNull,
    nullable: notNull || primaryKey ? false : explicitNull ? true : undefined,
    primaryKey: primaryKey || undefined,
    defaultValue,
    modifyDef: [typeStr, joinToks(modifyToks)].filter(Boolean).join(' '),
    extra: upperCmp(extraToks),
    unique,
  };
}

function parseTables(ddl: string): ParsedTable[] {
  const toks = tokenize(ddl);
  const tables: ParsedTable[] = [];
  for (let i = 0; i < toks.length; i++) {
    if (!isKw(toks[i], 'CREATE')) continue;
    let j = i + 1;
    while (isKw(toks[j], 'OR', 'REPLACE', 'TEMP', 'TEMPORARY', 'UNLOGGED', 'GLOBAL', 'LOCAL', 'VIRTUAL')) j++;
    if (!isKw(toks[j], 'TABLE')) continue;
    j++;
    if (isKw(toks[j], 'IF') && isKw(toks[j + 1], 'NOT') && isKw(toks[j + 2], 'EXISTS')) j += 3;
    const nameToks: Tok[] = [];
    while (isIdent(toks[j])) {
      nameToks.push(toks[j++]);
      if (toks[j]?.t === '.') j++; else break;
    }
    if (!nameToks.length || toks[j]?.t !== '(') continue;
    const close = matchParen(toks, j);
    // statement text runs to ';' or the next CREATE
    let stmtEnd = close;
    while (stmtEnd + 1 < toks.length && toks[stmtEnd + 1].t !== ';' && !isKw(toks[stmtEnd + 1], 'CREATE')) stmtEnd++;
    const endTok = toks[Math.min(stmtEnd, toks.length - 1)];
    const name = nameToks.map(t => t.v).join('.');
    const table: ParsedTable = {
      key: nameToks.map(identKey).join('.'),
      name,
      rawName: nameToks.map(t => t.raw).join('.'),
      statement: ddl.slice(toks[i].start, endTok.end).trim() + ';',
      columns: [],
    };
    for (const item of splitTop(toks.slice(j + 1, close), ',')) {
      const col = parseColumnItem(item, name);
      if (col) table.columns.push(col);
    }
    tables.push(table);
    i = close;
  }
  if (tables.length === 0) {
    // Fallback: a bare column list such as "(id INT, name TEXT)".
    const open = toks.findIndex(t => t.t === '(');
    if (open !== -1) {
      const close = matchParen(toks, open);
      const columns = splitTop(toks.slice(open + 1, close), ',')
        .map(item => parseColumnItem(item, ''))
        .filter((c): c is ParsedColumn => c !== null);
      if (columns.length) tables.push({ key: '', name: '', rawName: '', statement: '', columns });
    }
  }
  return tables;
}

function toPublicColumn(c: ParsedColumn): ColumnDef {
  const out: ColumnDef = { name: c.name, type: c.type, table: c.table, definition: c.definition, rawName: c.rawName };
  if (c.nullable !== undefined) out.nullable = c.nullable;
  if (c.primaryKey) out.primaryKey = true;
  if (c.defaultValue !== undefined) out.defaultValue = c.defaultValue;
  return out;
}

interface TableDiff {
  before: ParsedTable;
  after: ParsedTable;
  added: ParsedColumn[];
  removed: ParsedColumn[];
  changed: [ParsedColumn, ParsedColumn][];
}

function diffParsed(beforeTables: ParsedTable[], afterTables: ParsedTable[]) {
  // A lone table on each side is compared even if it was renamed (or is the anonymous fallback).
  const pairByPosition = beforeTables.length === 1 && afterTables.length === 1 && (beforeTables[0].key === '' || afterTables[0].key === '');
  const afterByKey = new Map(afterTables.map(t => [t.key, t]));
  const beforeKeys = new Set(beforeTables.map(t => t.key));
  const tableDiffs: TableDiff[] = [];
  const removedTables: ParsedTable[] = [];
  for (const bt of beforeTables) {
    const at = pairByPosition ? afterTables[0] : afterByKey.get(bt.key);
    if (!at) { removedTables.push(bt); continue; }
    const bMap = new Map(bt.columns.map(c => [c.key, c]));
    const aMap = new Map(at.columns.map(c => [c.key, c]));
    tableDiffs.push({
      before: bt,
      after: at,
      added: at.columns.filter(c => !bMap.has(c.key)),
      removed: bt.columns.filter(c => !aMap.has(c.key)),
      changed: bt.columns
        .filter(c => aMap.has(c.key) && aMap.get(c.key)!.cmp !== c.cmp)
        .map(c => [c, aMap.get(c.key)!] as [ParsedColumn, ParsedColumn]),
    });
  }
  const addedTables = pairByPosition ? [] : afterTables.filter(t => !beforeKeys.has(t.key));
  return { tableDiffs, addedTables, removedTables };
}

/**
 * Compares CREATE TABLE statements (one or many). Table-level constraints are ignored, comments are
 * stripped, quoted identifiers ("x", `x`, [x]) are supported, and unquoted identifiers compare
 * case-insensitively (double-quoted ones are case-sensitive).
 */
export function diffDdlStatements(before: string, after: string): DdlDiff {
  const { tableDiffs, addedTables, removedTables } = diffParsed(parseTables(before), parseTables(after));
  return {
    added: tableDiffs.flatMap(d => d.added.map(toPublicColumn)),
    removed: tableDiffs.flatMap(d => d.removed.map(toPublicColumn)),
    changed: tableDiffs.flatMap(d => d.changed.map(([b, a]) => ({
      name: b.name, before: b.definition, after: a.definition, table: b.table,
      beforeColumn: toPublicColumn(b), afterColumn: toPublicColumn(a),
    }))),
    addedTables: addedTables.map(t => t.name),
    removedTables: removedTables.map(t => t.name),
  };
}

// ---------------------------------------------------------------------------
// generateMigrationSql
// ---------------------------------------------------------------------------

const NO_CHANGES = '-- No schema changes';

/**
 * Generates up/down migration SQL between two DDL snapshots.
 * Postgres type / NOT NULL / DEFAULT changes become separate ALTER COLUMN statements; MySQL uses
 * MODIFY COLUMN with the full new definition. A dropped + added column pair of the same type is
 * flagged as a possible rename. Throws when neither side contains a CREATE TABLE.
 */
export function generateMigrationSql(before: string, after: string, dialect: 'postgres' | 'mysql'): MigrationSql {
  const beforeTables = parseTables(before);
  const afterTables = parseTables(after);
  if (beforeTables.length === 0 && afterTables.length === 0) {
    throw new Error('No CREATE TABLE statement found in either the "before" or the "after" DDL.');
  }
  const { tableDiffs, addedTables, removedTables } = diffParsed(beforeTables, afterTables);
  const up: string[] = [];
  const downGroups: string[][] = [];
  const warnings: string[] = [];

  for (const t of addedTables) {
    up.push(t.statement);
    downGroups.push([`DROP TABLE ${t.rawName};`]);
  }

  for (const d of tableDiffs) {
    const tn = d.before.rawName || d.after.rawName || 'table';
    const alter = (s: string) => `ALTER TABLE ${tn} ${s};`;

    // possible renames: dropped and added column with the same type
    const pairedAdded = new Set<ParsedColumn>();
    for (const r of d.removed) {
      const a = d.added.find(x => !pairedAdded.has(x) && x.type.toUpperCase() === r.type.toUpperCase());
      if (!a) continue;
      pairedAdded.add(a);
      const msg = `possible rename ${tn}.${r.rawName} -> ${a.rawName} (both ${r.type}); DROP+ADD loses data. ` +
        `To keep the data use: ALTER TABLE ${tn} RENAME COLUMN ${r.rawName} TO ${a.rawName};`;
      warnings.push(msg);
      up.push(`-- WARNING: ${msg}`);
    }

    for (const c of d.added) {
      up.push(alter(`ADD COLUMN ${c.rawName} ${c.definition}`));
      downGroups.push([alter(`DROP COLUMN ${c.rawName}`)]);
    }
    for (const c of d.removed) {
      up.push(alter(`DROP COLUMN ${c.rawName}`));
      downGroups.push([alter(`ADD COLUMN ${c.rawName} ${c.definition}`)]);
    }
    for (const [b, a] of d.changed) {
      const col = a.rawName;
      if (dialect === 'mysql') {
        up.push(alter(`MODIFY COLUMN ${col} ${a.modifyDef}`));
        downGroups.push([alter(`MODIFY COLUMN ${b.rawName} ${b.modifyDef}`)]);
        if (!!b.primaryKey !== !!a.primaryKey || b.unique !== a.unique) {
          const msg = `PRIMARY KEY / UNIQUE change on ${tn}.${col} is not applied by MODIFY COLUMN; add or drop the key/index manually`;
          warnings.push(msg);
          up.push(`-- WARNING: ${msg}`);
        }
      } else {
        const upPart: string[] = [];
        const downPart: string[] = [];
        if (b.type.toUpperCase() !== a.type.toUpperCase()) {
          upPart.push(alter(`ALTER COLUMN ${col} TYPE ${a.type}`));
          downPart.push(alter(`ALTER COLUMN ${col} TYPE ${b.type}`));
        }
        if (b.notNull !== a.notNull) {
          upPart.push(alter(`ALTER COLUMN ${col} ${a.notNull ? 'SET' : 'DROP'} NOT NULL`));
          downPart.push(alter(`ALTER COLUMN ${col} ${b.notNull ? 'SET' : 'DROP'} NOT NULL`));
        }
        if ((b.defaultValue ?? '') !== (a.defaultValue ?? '')) {
          upPart.push(alter(a.defaultValue !== undefined ? `ALTER COLUMN ${col} SET DEFAULT ${a.defaultValue}` : `ALTER COLUMN ${col} DROP DEFAULT`));
          downPart.push(alter(b.defaultValue !== undefined ? `ALTER COLUMN ${col} SET DEFAULT ${b.defaultValue}` : `ALTER COLUMN ${col} DROP DEFAULT`));
        }
        const handled = upPart.length > 0;
        if (!handled || b.extra !== a.extra) {
          const msg = `constraint change on ${tn}.${col} needs a manual migration: "${b.definition}" -> "${a.definition}"`;
          warnings.push(msg);
          upPart.push(`-- WARNING: ${msg}`);
        }
        up.push(...upPart);
        downGroups.push(downPart.length ? downPart : [`-- WARNING: revert ${tn}.${col} manually to "${b.definition}"`]);
      }
    }
  }

  for (const t of removedTables) {
    up.push(`DROP TABLE ${t.rawName || 'table'};`);
    downGroups.push([t.statement || `-- WARNING: re-create the dropped table manually`]);
  }

  if (up.length === 0) return { up: NO_CHANGES, down: NO_CHANGES, warnings: [], hasChanges: false };
  return { up: up.join('\n'), down: downGroups.reverse().flat().join('\n'), warnings, hasChanges: true };
}

// ---------------------------------------------------------------------------
// detectSlowQueryPatterns
// ---------------------------------------------------------------------------

/** Main statement keyword, looking past a WITH … AS (…) prefix. */
function statementKind(stmt: Tok[]): string {
  let depth = 0;
  const first = stmt.find(t => t.t === 'id');
  if (!first) return '';
  if (!isKw(first, 'WITH')) return first.v.toUpperCase();
  for (const t of stmt) {
    if (t.t === '(') depth++;
    else if (t.t === ')') depth--;
    else if (depth === 0 && isKw(t, 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE')) return t.v.toUpperCase();
  }
  return 'WITH';
}

/** Tokens at paren depth 0 (relative to the statement start). */
function topLevel(stmt: Tok[]): Tok[] {
  let depth = 0;
  const out: Tok[] = [];
  for (const t of stmt) {
    if (t.t === '(') { depth++; continue; }
    if (t.t === ')') { depth--; continue; }
    if (depth === 0) out.push(t);
  }
  return out;
}

export function detectSlowQueryPatterns(sql: string): SlowQueryPattern[] {
  const results: SlowQueryPattern[] = [];
  const seen = new Set<string>();
  const add = (p: SlowQueryPattern) => { if (!seen.has(p.pattern)) { seen.add(p.pattern); results.push(p); } };

  for (const stmt of splitTop(tokenize(sql), ';')) {
    const kind = statementKind(stmt);
    const top = topLevel(stmt);

    for (let i = 0; i < stmt.length; i++) {
      if (!isKw(stmt[i], 'SELECT')) continue;
      let j = i + 1;
      if (isKw(stmt[j], 'DISTINCT', 'ALL')) j++;
      if (isKw(stmt[j], 'TOP')) j += stmt[j + 1]?.t === '(' ? 4 : 2;
      if (stmt[j]?.t === 'op' && stmt[j].v === '*') {
        add({ pattern: 'SELECT *', severity: 'warning', explanation: 'Selecting all columns increases data transfer and prevents index-only scans.', suggestion: 'List only the columns you need.' });
      }
    }
    for (let i = 0; i < stmt.length - 1; i++) {
      if (isKw(stmt[i], 'LIKE', 'ILIKE') && !isKw(stmt[i - 1], 'NOT') && stmt[i + 1].t === 'str' && stmt[i + 1].v.startsWith('%')) {
        add({ pattern: 'Leading wildcard LIKE', severity: 'warning', explanation: "A leading wildcard (LIKE '%foo') prevents index use and forces a full table scan.", suggestion: 'Use a suffix index or full-text search.' });
      }
      if (isKw(stmt[i], 'NOT') && isKw(stmt[i + 1], 'IN') && stmt[i + 2]?.t === '(' && isKw(stmt[i + 3], 'SELECT', 'WITH')) {
        add({ pattern: 'NOT IN with subquery', severity: 'warning', explanation: 'NOT IN with a subquery can be slow and returns unexpected results with NULLs.', suggestion: 'Use NOT EXISTS instead.' });
      }
    }
    if ((kind === 'UPDATE' || kind === 'DELETE') && !top.some(t => isKw(t, 'WHERE'))) {
      add({ pattern: 'UPDATE/DELETE without WHERE', severity: 'error', explanation: 'This will modify or delete all rows in the table.', suggestion: 'Add a WHERE clause.' });
    }
    if (kind === 'SELECT') {
      const hasFrom = top.some(t => isKw(t, 'FROM'));
      const limited = top.some((t, i) =>
        isKw(t, 'LIMIT') || isKw(t, 'TOP') || (isKw(t, 'FETCH') && isKw(top[i + 1], 'FIRST', 'NEXT')));
      const aggregate = stmt.some((t, i) => isKw(t, 'COUNT') && stmt[i + 1]?.t === '(');
      if (hasFrom && !limited && !aggregate) {
        add({ pattern: 'No LIMIT clause', severity: 'info', explanation: 'Unbounded SELECT may return large result sets.', suggestion: 'Add a LIMIT (or TOP / FETCH FIRST n ROWS) clause for pagination.' });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// analyzeQueryForIndexes
// ---------------------------------------------------------------------------

const NON_COLUMN_WORDS = new Set([
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE', 'TRUE', 'FALSE', 'EXISTS', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'ESCAPE', 'ANY', 'ALL', 'SOME', 'INTERVAL', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'LOCALTIME', 'LOCALTIMESTAMP', 'DISTINCT', 'AS', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'COLLATE', 'SIMILAR', 'TO',
  'UNKNOWN', 'ON', 'USING',
]);
const CLAUSE_WORDS = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'FETCH', 'UPDATE', 'SET', 'DELETE', 'RETURNING', 'WINDOW', 'QUALIFY', 'FOR', 'INTO', 'VALUES']);
const SET_OPS = new Set(['UNION', 'INTERSECT', 'EXCEPT']);
const JOIN_WORDS = new Set(['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL', 'OUTER', 'STRAIGHT_JOIN', 'LATERAL', 'APPLY']);
const ALIAS_STOP = new Set([...CLAUSE_WORDS, ...JOIN_WORDS, ...SET_OPS, 'ON', 'USING', 'WITH', 'AS', 'GROUP', 'ORDER']);

interface ColRef { qualifier?: string; name: string; raw: string }
interface TableRef { name: string; raw: string }

/** Reads a column reference (a, t.a, s.t.a) starting at toks[i]; returns null for functions / literals / keywords. */
function readColRef(toks: Tok[], i: number): { ref: ColRef; next: number } | null {
  const parts: Tok[] = [];
  let j = i;
  while (isIdent(toks[j])) {
    parts.push(toks[j++]);
    if (toks[j]?.t === '.' && isIdent(toks[j + 1])) j++; else break;
  }
  if (!parts.length || parts[0].v === '__subquery__') return null;
  if (toks[j]?.t === '(') return null; // function call
  const last = parts[parts.length - 1];
  if (last.t === 'id' && NON_COLUMN_WORDS.has(last.v.toUpperCase()) && parts.length === 1) return null;
  if (parts.length === 1 && isKw(last, 'DATE', 'TIME', 'TIMESTAMP') && toks[j]?.t === 'str') return null; // DATE '2020-01-01'
  return {
    ref: { name: last.v, raw: last.raw, qualifier: parts.length > 1 ? parts.slice(0, -1).map(p => p.v).join('.') : undefined },
    next: j,
  };
}

type PredKind = 'eq' | 'range' | 'neq' | 'skip';

/** Splits a boolean condition into simple predicates (on AND / OR, flattening grouping parens). */
function splitPredicates(toks: Tok[]): Tok[][] {
  const preds: Tok[][] = [];
  let cur: Tok[] = [];
  let betweenPending = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t === '(') {
      const prev = toks[i - 1];
      const isGroup = !(prev && (isKw(prev, 'IN', 'EXISTS', 'ANY', 'ALL', 'SOME') || (isIdent(prev) && !(prev.t === 'id' && NON_COLUMN_WORDS.has(prev.v.toUpperCase())))));
      if (!isGroup) {
        const close = matchParen(toks, i);
        cur.push(...toks.slice(i, close + 1));
        i = close;
        continue;
      }
      continue; // grouping paren: flatten
    }
    if (t.t === ')') continue;
    if (isKw(t, 'BETWEEN')) betweenPending = true;
    if (isKw(t, 'AND') && betweenPending) { betweenPending = false; cur.push(t); continue; }
    if (isKw(t, 'AND', 'OR')) { if (cur.length) preds.push(cur); cur = []; continue; }
    cur.push(t);
  }
  if (cur.length) preds.push(cur);
  return preds;
}

function classifyPredicate(p: Tok[]): PredKind {
  const has = (...w: string[]) => p.some(t => isKw(t, ...w));
  const not = has('NOT');
  const opTok = p.find(t => t.t === 'op' && ['=', '<>', '!=', '<', '>', '<=', '>=', '<=>'].includes(t.v));
  const likeIdx = p.findIndex(t => isKw(t, 'LIKE', 'ILIKE'));
  if (likeIdx !== -1) {
    const pat = p[likeIdx + 1];
    if (not || (pat?.t === 'str' && /^[%_]/.test(pat.v))) return 'skip';
    return 'range';
  }
  if (has('IS')) return not ? 'range' : 'eq';
  if (has('BETWEEN')) return not ? 'neq' : 'range';
  if (has('IN')) return not ? 'neq' : 'eq';
  if (!opTok) return 'skip';
  if (opTok.v === '=' || opTok.v === '<=>') return not ? 'neq' : 'eq';
  if (opTok.v === '<>' || opTok.v === '!=') return 'neq';
  return 'range';
}

/** Column refs in a predicate, skipping function-call arguments and IN-lists. */
function predicateColumns(p: Tok[]): ColRef[] {
  const refs: ColRef[] = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i].t === '(') { i = matchParen(p, i); continue; }
    if (isIdent(p[i]) && p[i + 1]?.t === '(') { i = matchParen(p, i + 1); continue; }
    const r = readColRef(p, i);
    if (r) { refs.push(r.ref); i = r.next - 1; }
  }
  return refs;
}

interface Clauses { [k: string]: Tok[] }

/** Splits a statement into its depth-0 clauses; subqueries are returned separately. */
function splitClauses(stmt: Tok[], subqueries: Tok[][]): Clauses {
  const clauses: Clauses = {};
  let current = '';
  let depth = 0;
  for (let i = 0; i < stmt.length; i++) {
    const t = stmt[i];
    if (t.t === '(' && isKw(stmt[i + 1], 'SELECT', 'WITH')) {
      const close = matchParen(stmt, i);
      subqueries.push(stmt.slice(i + 1, close));
      (clauses[current] ??= []).push({ ...t, t: 'id', v: '__subquery__', raw: '__subquery__' });
      i = close;
      continue;
    }
    if (t.t === '(') depth++;
    if (t.t === ')') depth--;
    if (depth === 0 && t.t === 'id') {
      const u = t.v.toUpperCase();
      if (SET_OPS.has(u)) {
        let k = i + 1;
        if (isKw(stmt[k], 'ALL', 'DISTINCT')) k++;
        subqueries.push(stmt.slice(k));
        break;
      }
      if ((u === 'GROUP' || u === 'ORDER') && isKw(stmt[i + 1], 'BY')) { current = u; i++; continue; }
      if (CLAUSE_WORDS.has(u) && !(u === 'FOR' && current === '')) { current = u; continue; }
    }
    (clauses[current] ??= []).push(t);
  }
  return clauses;
}

interface JoinInfo { table: TableRef; on: Tok[]; using: string[] }

function parseTableRefs(toks: Tok[], aliases: Map<string, TableRef>): { tables: TableRef[]; joins: JoinInfo[] } {
  const tables: TableRef[] = [];
  const joins: JoinInfo[] = [];
  let i = 0;
  let joined = false;
  while (i < toks.length) {
    while (i < toks.length && (toks[i].t === ',' || (toks[i].t === 'id' && JOIN_WORDS.has(toks[i].v.toUpperCase())))) {
      if (toks[i].t === 'id' && JOIN_WORDS.has(toks[i].v.toUpperCase())) joined = true;
      if (toks[i].t === ',') joined = false;
      i++;
    }
    if (i >= toks.length) break;
    const nameToks: Tok[] = [];
    while (isIdent(toks[i])) {
      nameToks.push(toks[i++]);
      if (toks[i]?.t === '.') i++; else break;
    }
    if (!nameToks.length) { i++; continue; }
    const ref: TableRef = { name: nameToks.map(t => t.v).join('.'), raw: nameToks.map(t => t.raw).join('.') };
    if (toks[i]?.t === '(') i = matchParen(toks, i) + 1; // table function args / WITH (NOLOCK)
    if (isKw(toks[i], 'AS')) i++;
    if (isIdent(toks[i]) && !(toks[i].t === 'id' && ALIAS_STOP.has(toks[i].v.toUpperCase()))) {
      aliases.set(identKey(toks[i]), ref);
      i++;
    }
    if (isKw(toks[i], 'WITH') && toks[i + 1]?.t === '(') i = matchParen(toks, i + 1) + 1;
    if (ref.name !== '__subquery__') {
      aliases.set(ref.name.toLowerCase(), ref);
      aliases.set(nameToks[nameToks.length - 1].v.toLowerCase(), ref);
      tables.push(ref);
    }
    const join: JoinInfo = { table: ref, on: [], using: [] };
    if (isKw(toks[i], 'ON')) {
      i++;
      let depth = 0;
      while (i < toks.length) {
        const t = toks[i];
        if (t.t === '(') depth++;
        if (t.t === ')') depth--;
        if (depth === 0 && (t.t === ',' || (t.t === 'id' && JOIN_WORDS.has(t.v.toUpperCase())))) break;
        join.on.push(t);
        i++;
      }
    } else if (isKw(toks[i], 'USING') && toks[i + 1]?.t === '(') {
      const close = matchParen(toks, i + 1);
      join.using = toks.slice(i + 2, close).filter(isIdent).map(t => t.v);
      i = close + 1;
    }
    if (joined && ref.name !== '__subquery__') joins.push(join);
  }
  return { tables, joins };
}

function selectAliases(selectToks: Tok[]): Set<string> {
  const out = new Set<string>();
  for (let item of splitTop(selectToks, ',')) {
    while (isKw(item[0], 'DISTINCT', 'ALL')) item = item.slice(1);
    if (isKw(item[0], 'TOP')) item = item.slice(item[1]?.t === '(' ? 4 : 2);
    if (item.length < 2) continue;
    const last = item[item.length - 1];
    const prev = item[item.length - 2];
    if (!isIdent(last)) continue;
    if (isKw(prev, 'AS') || (prev.t !== '.' && prev.t !== 'op' && !isKw(prev, 'DISTINCT'))) out.add(identKey(last));
  }
  return out;
}

interface TableCols { table: TableRef; eq: string[]; range: string[]; neq: string[]; join: string[]; order: string[]; orderOther: boolean; hasOr: boolean }

/**
 * Suggests indexes for a query. Resolves table aliases, attributes JOIN ON columns to the joined
 * table, ignores string literals / SELECT aliases, understands =, IN, BETWEEN, IS [NOT] NULL, range
 * and prefix-LIKE predicates, and proposes a composite index (equality columns, then ORDER BY or
 * the first range column) when a query filters on several columns of one table.
 */
export function analyzeQueryForIndexes(sql: string): IndexSuggestion[] {
  const byTable = new Map<string, TableCols>();
  const queue: Tok[][] = splitTop(tokenize(sql), ';');

  const bucket = (t: TableRef): TableCols => {
    const k = t.name.toLowerCase();
    if (!byTable.has(k)) byTable.set(k, { table: t, eq: [], range: [], neq: [], join: [], order: [], orderOther: false, hasOr: false });
    return byTable.get(k)!;
  };
  const pushUnique = (arr: string[], v: string) => { if (!arr.some(x => x.toLowerCase() === v.toLowerCase())) arr.push(v); };

  for (let q = 0; q < queue.length && q < 50; q++) {
    const clauses = splitClauses(queue[q], queue);
    const aliases = new Map<string, TableRef>();
    const source = [...(clauses['FROM'] ?? [])];
    const { tables, joins } = parseTableRefs(clauses['UPDATE'] ?? [], aliases);
    const fromRefs = parseTableRefs(source, aliases);
    tables.push(...fromRefs.tables);
    joins.push(...fromRefs.joins);
    const main: TableRef = tables[0] ?? { name: 'table', raw: 'table' };
    const resolve = (r: ColRef, fallback: TableRef): TableRef =>
      r.qualifier ? (aliases.get(r.qualifier.toLowerCase()) ?? { name: r.qualifier, raw: r.qualifier }) : fallback;

    const where = clauses['WHERE'] ?? [];
    const whereHasOr = where.some(t => isKw(t, 'OR'));
    for (const pred of splitPredicates(where)) {
      const kind = classifyPredicate(pred);
      if (kind === 'skip') continue;
      for (const r of predicateColumns(pred)) {
        const b = bucket(resolve(r, main));
        pushUnique(b[kind], r.raw);
        if (whereHasOr) b.hasOr = true;
      }
    }
    for (const j of joins) {
      for (const pred of splitPredicates(j.on)) {
        for (const r of predicateColumns(pred)) pushUnique(bucket(resolve(r, j.table)).join, r.raw);
      }
      for (const u of j.using) pushUnique(bucket(j.table).join, u);
    }
    const aliasesInSelect = selectAliases(clauses['SELECT'] ?? []);
    for (const item of splitTop(clauses['ORDER'] ?? [], ',')) {
      const r = readColRef(item, 0);
      if (!r) continue;
      if (!r.ref.qualifier && aliasesInSelect.has(r.ref.raw.startsWith('"') ? r.ref.name : r.ref.name.toLowerCase())) continue;
      const target = resolve(r.ref, main);
      pushUnique(bucket(target).order, r.ref.raw);
      for (const other of byTable.values()) if (other.table.name.toLowerCase() !== target.name.toLowerCase()) other.orderOther = true;
    }
  }

  const suggestions: IndexSuggestion[] = [];
  const make = (t: TableRef, cols: string[], reason: string): IndexSuggestion => {
    const plain = cols.map(c => c.replace(/^["`[]|["`\]]$/g, ''));
    const idxName = `idx_${t.name.replace(/\W+/g, '_')}_${plain.map(c => c.replace(/\W+/g, '_')).join('_')}`;
    return { column: plain.join(', '), columns: plain, table: t.name, reason, sql: `CREATE INDEX ${idxName} ON ${t.raw} (${cols.join(', ')});` };
  };

  for (const tc of byTable.values()) {
    if (tc.table.name === '__subquery__') continue;
    const composite = [...tc.eq];
    const tail = tc.order.length && !tc.orderOther ? tc.order : tc.range.slice(0, 1);
    for (const c of tail) if (!composite.some(x => x.toLowerCase() === c.toLowerCase())) composite.push(c);
    const covered = new Set<string>();
    if (composite.length >= 2 && !tc.hasOr) {
      suggestions.push(make(tc.table, composite, 'Composite index: equality columns first, then the ORDER BY / range column'));
      composite.forEach(c => covered.add(c.toLowerCase()));
    }
    const singles: [string[], string][] = [
      [tc.eq, 'Equality filter in WHERE (=, IN, IS NULL)'],
      [tc.range, 'Range filter in WHERE (<, >, BETWEEN, prefix LIKE, IS NOT NULL)'],
      [tc.neq, 'Inequality filter in WHERE (<>, NOT IN) — an index helps only if few rows match'],
      [tc.join, 'JOIN condition (skip if this is already the primary key)'],
      [tc.order, 'Used in ORDER BY'],
    ];
    for (const [cols, reason] of singles) {
      for (const c of cols) {
        if (covered.has(c.toLowerCase())) continue;
        covered.add(c.toLowerCase());
        suggestions.push(make(tc.table, [c], reason));
      }
    }
  }
  return suggestions;
}
