export interface ColumnDef {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnDef[];
}

export interface DdlDiff {
  added: ColumnDef[];
  removed: ColumnDef[];
  changed: { name: string; before: string; after: string }[];
}

export interface SlowQueryPattern {
  pattern: string;
  severity: 'error' | 'warning' | 'info';
  explanation: string;
  suggestion: string;
}

export interface IndexSuggestion {
  column: string;
  reason: string;
  sql: string;
}

export interface MigrationSql {
  up: string;
  down: string;
}

export function generateCreateTable(schema: TableSchema, dialect: 'postgres' | 'mysql' | 'sqlite' | 'mssql'): string {
  const cols = schema.columns.map(col => {
    let type = col.type;
    let extra = '';
    if (col.primaryKey) {
      if (dialect === 'postgres') { type = 'SERIAL'; extra = ' PRIMARY KEY'; }
      else if (dialect === 'mysql') { extra = ' AUTO_INCREMENT PRIMARY KEY'; }
      else if (dialect === 'sqlite') { type = 'INTEGER'; extra = ' PRIMARY KEY AUTOINCREMENT'; }
      else if (dialect === 'mssql') { extra = ' IDENTITY(1,1) PRIMARY KEY'; }
    }
    const nullStr = col.nullable === false && !col.primaryKey ? ' NOT NULL' : '';
    const defStr = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
    return `  ${col.name} ${type}${extra}${nullStr}${defStr}`;
  });
  return `CREATE TABLE ${schema.tableName} (\n${cols.join(',\n')}\n);`;
}

function parseColumns(ddl: string): ColumnDef[] {
  const start = ddl.indexOf('(');
  const end = ddl.lastIndexOf(')');
  if (start === -1 || end === -1) return [];
  const inner = ddl.slice(start + 1, end);
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) { parts.push(current); }
  return parts.map(part => {
    const trimmed = part.trim();
    const [name, ...rest] = trimmed.split(/\s+/);
    return { name: name ?? '', type: rest.join(' ') };
  }).filter(c => c.name && !c.name.toUpperCase().startsWith('PRIMARY') && !c.name.toUpperCase().startsWith('FOREIGN'));
}

export function diffDdlStatements(before: string, after: string): DdlDiff {
  const beforeCols = parseColumns(before);
  const afterCols = parseColumns(after);
  const beforeMap = Object.fromEntries(beforeCols.map(c => [c.name, c]));
  const afterMap = Object.fromEntries(afterCols.map(c => [c.name, c]));
  return {
    added: afterCols.filter(c => !beforeMap[c.name]),
    removed: beforeCols.filter(c => !afterMap[c.name]),
    changed: beforeCols
      .filter(c => afterMap[c.name] && afterMap[c.name].type !== c.type)
      .map(c => ({ name: c.name, before: c.type, after: afterMap[c.name].type })),
  };
}

export function detectSlowQueryPatterns(sql: string): SlowQueryPattern[] {
  const results: SlowQueryPattern[] = [];
  const upper = sql.toUpperCase();
  if (/SELECT\s+\*/.test(upper)) {
    results.push({ pattern: 'SELECT *', severity: 'warning', explanation: 'Selecting all columns increases data transfer and prevents index-only scans.', suggestion: 'List only the columns you need.' });
  }
  if (/LIKE\s+['"]%/.test(upper)) {
    results.push({ pattern: 'Leading wildcard LIKE', severity: 'warning', explanation: "A leading wildcard (LIKE '%foo') prevents index use and forces a full table scan.", suggestion: 'Use a suffix index or full-text search.' });
  }
  if (/UPDATE|DELETE/.test(upper) && !/WHERE/.test(upper)) {
    results.push({ pattern: 'UPDATE/DELETE without WHERE', severity: 'error', explanation: 'This will modify or delete all rows in the table.', suggestion: 'Add a WHERE clause.' });
  }
  if (/NOT\s+IN\s*\(SELECT/.test(upper)) {
    results.push({ pattern: 'NOT IN with subquery', severity: 'warning', explanation: 'NOT IN with a subquery can be slow and returns unexpected results with NULLs.', suggestion: 'Use NOT EXISTS instead.' });
  }
  if (!/LIMIT/.test(upper) && /SELECT/.test(upper) && !/COUNT/.test(upper)) {
    results.push({ pattern: 'No LIMIT clause', severity: 'info', explanation: 'Unbounded SELECT may return large result sets.', suggestion: 'Add a LIMIT clause for pagination.' });
  }
  return results;
}

export function analyzeQueryForIndexes(sql: string): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];
  const tableName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? 'table';
  const whereIdx = sql.toUpperCase().indexOf('WHERE');
  const whereClause = whereIdx !== -1 ? sql.slice(whereIdx + 5) : '';
  const cols = [...whereClause.matchAll(/(\w+)\s*[=<>!]/g)].map(m => m[1]).filter(c => !/^(AND|OR|NOT|NULL|WHERE)$/i.test(c));
  const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)/i)?.[1];
  if (orderMatch) { cols.push(orderMatch); }
  const unique = [...new Set(cols)];
  for (const col of unique) {
    suggestions.push({
      column: col,
      reason: 'Used in WHERE / ORDER BY clause',
      sql: `CREATE INDEX idx_${tableName}_${col} ON ${tableName} (${col});`,
    });
  }
  return suggestions;
}

export function generateMigrationSql(before: string, after: string, dialect: 'postgres' | 'mysql'): MigrationSql {
  const diff = diffDdlStatements(before, after);
  const tableName = before.match(/TABLE\s+(\w+)/i)?.[1] ?? 'table';
  const upLines: string[] = [];
  const downLines: string[] = [];
  for (const col of diff.added) {
    upLines.push(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type};`);
    downLines.push(`ALTER TABLE ${tableName} DROP COLUMN ${col.name};`);
  }
  for (const col of diff.removed) {
    upLines.push(`ALTER TABLE ${tableName} DROP COLUMN ${col.name};`);
    downLines.push(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type};`);
  }
  for (const col of diff.changed) {
    const alterType = dialect === 'postgres'
      ? `ALTER TABLE ${tableName} ALTER COLUMN ${col.name} TYPE ${col.after};`
      : `ALTER TABLE ${tableName} MODIFY COLUMN ${col.name} ${col.after};`;
    const revertType = dialect === 'postgres'
      ? `ALTER TABLE ${tableName} ALTER COLUMN ${col.name} TYPE ${col.before};`
      : `ALTER TABLE ${tableName} MODIFY COLUMN ${col.name} ${col.before};`;
    upLines.push(alterType);
    downLines.push(revertType);
  }
  return { up: upLines.join('\n'), down: downLines.join('\n') };
}
