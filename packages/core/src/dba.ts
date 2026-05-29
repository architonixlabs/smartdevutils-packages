export interface ConnectionStringParts {
  protocol: string; username: string; password: string;
  host: string; port: string; database: string;
}

export function jsonToSqlInserts(json: string, tableName: string): string {
  const rows = JSON.parse(json);
  if (!Array.isArray(rows)) throw new Error('Input must be a JSON array');
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  return rows.map(row => {
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');
    return `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals});`;
  }).join('\n');
}

export function parseConnectionString(uri: string): ConnectionStringParts {
  const empty: ConnectionStringParts = { protocol: '', username: '', password: '', host: '', port: '', database: '' };
  try {
    const m = uri.match(/^([a-z][a-z0-9+\-.]+):\/\/(?:([^:@]*)(?::([^@]*))?@)?([^/:?]+)(?::(\d+))?(?:\/([^?]*))?/i);
    if (!m) return empty;
    return { protocol: m[1]??'', username: m[2]??'', password: m[3]??'', host: m[4]??'', port: m[5]??'', database: m[6]??'' };
  } catch { return empty; }
}

export function sanitizeSql(input: string): string {
  return input.replace(/'/g, "''").replace(/--/g, '').replace(/\/\*/g, '').replace(/\*\//g, '');
}
