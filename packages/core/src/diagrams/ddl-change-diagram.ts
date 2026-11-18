import { DdlToErdService, ErdForeignKey, ErdTable, mermaidId, mermaidType, resolveForeignKey, uniqueIds } from './ddl-to-erd';

/** "changed": changed tables plus the tables they link to by a foreign key. "all": every table. */
export type ChangeScope = 'changed' | 'all';

export interface DdlChangeSummary {
  tablesAdded: number;
  tablesRemoved: number;
  tablesChanged: number;
  columnsAdded: number;
  columnsRemoved: number;
  typesChanged: number;
  relationshipsAdded: number;
  relationshipsRemoved: number;
}

export interface DdlChangeDiagram {
  /** Mermaid erDiagram source, or '' when the two schemas have no difference. */
  source: string;
  summary: DdlChangeSummary;
  /** Plain-text notes such as "customers looks like a rename of clients". */
  renameHints: string[];
  /** True when tables or relationships were left out to stay under the limit. */
  capped: boolean;
  shownTables: number;
  totalTables: number;
}

export const DDL_CHANGE_LEGEND =
  'Green box: new table. Red box: dropped table. Amber box: changed table. ' +
  'Column notes: "+ added", "− removed", "~ type: old → new". ' +
  'Relationship labels: "+" added, "−" removed (removed ones are drawn dotted).';

export const DDL_CHANGE_MAX = 300;

type Status = 'added' | 'removed' | 'changed' | 'same';

interface Entity {
  key: string;
  status: Status;
  table: ErdTable;          // after version, or before version for a dropped table
  before?: ErdTable;
  renamedFrom?: string;     // name of a dropped table this new table looks like
}

interface Rel {
  key: string;
  status: 'added' | 'removed' | 'same';
  from: string;             // entity key
  to: string;               // entity key, or '' when the target table is not in the input
  toRaw: string;            // referenced table name as written
  columns: string[];
  card: string;
}

const svc = new DdlToErdService();

const tableKey = (t: { schema: string; name: string }) => `${t.schema.toLowerCase()}.${t.name.toLowerCase()}`;
const normType = (t: string) => t.trim().replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').toLowerCase();
const colSet = (cols: string[]) => cols.map(c => c.toLowerCase()).sort().join('\u0000');

/** Text inside a quoted Mermaid comment or label: no quotes, no "%%", no line breaks, short. */
function safeText(s: string, max = 60): string {
  const t = s.replace(/[\r\n\t]+/g, ' ').replace(/[^A-Za-z0-9 _(),.:/+\-→−~]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Relationship identity: entity keys on both ends (a kept table has one entity for both versions) plus the columns. */
function fkKey(fromKey: string, fk: ErdForeignKey, toKey: string | undefined): string {
  const to = toKey ?? '?' + fk.refTable.map(p => p.toLowerCase()).join('.');
  return `${fromKey}|${colSet(fk.columns)}|${to}`;
}

/** Same cardinality rule as the DDL to ERD tool. */
function cardinality(t: ErdTable, fk: ErdForeignKey): string {
  const cols = fk.columns.map(n => t.columns.find(c => c.name.toLowerCase() === n.toLowerCase()));
  const optional = cols.some(c => !c || !c.notNull);
  const lower = colSet(fk.columns);
  const isUnique = t.uniques.some(u => colSet(u) === lower) || colSet(t.primaryKey) === lower;
  return `${isUnique ? '|o' : '}o'}--${optional ? 'o|' : '||'}`;
}

/** Pairs each after table with its before version: same schema and name, else same name when only one is left. */
function matchTables(before: ErdTable[], after: ErdTable[]): Map<ErdTable, ErdTable> {
  const pairs = new Map<ErdTable, ErdTable>();
  const used = new Set<ErdTable>();
  for (const a of after) {
    const b = before.find(x => !used.has(x) && tableKey(x) === tableKey(a));
    if (b) { pairs.set(a, b); used.add(b); }
  }
  for (const a of after) {
    if (pairs.has(a)) continue;
    const left = before.filter(x => !used.has(x) && x.name.toLowerCase() === a.name.toLowerCase());
    const others = after.filter(x => !pairs.has(x) && x.name.toLowerCase() === a.name.toLowerCase());
    if (left.length === 1 && others.length === 1) { pairs.set(a, left[0]); used.add(left[0]); }
  }
  return pairs;
}

const emptySummary = (): DdlChangeSummary => ({
  tablesAdded: 0, tablesRemoved: 0, tablesChanged: 0, columnsAdded: 0, columnsRemoved: 0, typesChanged: 0,
  relationshipsAdded: 0, relationshipsRemoved: 0,
});

/**
 * Compares two schemas (CREATE TABLE / ALTER TABLE DDL) and draws one Mermaid erDiagram of the after schema plus the
 * dropped tables, with every change marked. Mermaid can colour whole tables (classDef) but not single columns or
 * relationships, so column and relationship changes are marked in their text.
 */
export function buildDdlChangeDiagram(beforeSql: string, afterSql: string, scope: ChangeScope = 'changed', max = DDL_CHANGE_MAX): DdlChangeDiagram {
  const before = svc.parse(beforeSql || '').tables;
  const after = svc.parse(afterSql || '').tables;
  const summary = emptySummary();
  const none: DdlChangeDiagram = { source: '', summary, renameHints: [], capped: false, shownTables: 0, totalTables: 0 };
  if (!before.length && !after.length) return none;

  const pairs = matchTables(before, after);
  const matchedBefore = new Set(pairs.values());
  const entities: Entity[] = [];
  const byKey = new Map<string, Entity>();
  const add = (e: Entity) => {
    let key = e.key, k = 2;
    while (byKey.has(key)) key = `${e.key}#${k++}`; // duplicate CREATE TABLE in one input
    e.key = key;
    entities.push(e);
    byKey.set(key, e);
  };
  const entityOf = new Map<ErdTable, Entity>();
  for (const a of after) {
    const b = pairs.get(a);
    const e: Entity = { key: tableKey(a), status: b ? 'same' : 'added', table: a, before: b };
    add(e);
    entityOf.set(a, e);
    if (b) entityOf.set(b, e);
  }
  for (const b of before) {
    if (matchedBefore.has(b)) continue;
    const e: Entity = { key: tableKey(b), status: 'removed', table: b };
    add(e);
    entityOf.set(b, e);
  }

  // column changes
  for (const e of entities) {
    if (e.status === 'added') { summary.tablesAdded++; continue; }
    if (e.status === 'removed') { summary.tablesRemoved++; continue; }
    const b = e.before!;
    const bCols = new Map(b.columns.map(c => [c.name.toLowerCase(), c]));
    const aCols = new Set(e.table.columns.map(c => c.name.toLowerCase()));
    for (const c of e.table.columns) {
      const old = bCols.get(c.name.toLowerCase());
      if (!old) { summary.columnsAdded++; e.status = 'changed'; }
      else if (normType(old.type) !== normType(c.type)) { summary.typesChanged++; e.status = 'changed'; }
    }
    for (const c of b.columns) if (!aCols.has(c.name.toLowerCase())) { summary.columnsRemoved++; e.status = 'changed'; }
  }

  // relationships
  const rels: Rel[] = [];
  const afterFks = new Map<string, Rel>();
  for (const a of after) {
    for (const fk of a.foreignKeys) {
      const target = resolveForeignKey(after, fk, a);
      const key = fkKey(entityOf.get(a)!.key, fk, target && entityOf.get(target)!.key);
      if (afterFks.has(key)) continue;
      const rel: Rel = {
        key, status: 'added', from: entityOf.get(a)!.key, to: target ? entityOf.get(target)!.key : '',
        toRaw: fk.refTable[fk.refTable.length - 1] ?? '', columns: fk.columns, card: cardinality(a, fk),
      };
      afterFks.set(key, rel);
      rels.push(rel);
    }
  }
  const beforeKeys = new Set<string>();
  for (const b of before) {
    for (const fk of b.foreignKeys) {
      const target = resolveForeignKey(before, fk, b);
      const key = fkKey(entityOf.get(b)!.key, fk, target && entityOf.get(target)!.key);
      if (beforeKeys.has(key)) continue;
      beforeKeys.add(key);
      const kept = afterFks.get(key);
      if (kept) { kept.status = 'same'; continue; }
      rels.push({
        key, status: 'removed', from: entityOf.get(b)!.key, to: target ? entityOf.get(target)!.key : '',
        toRaw: fk.refTable[fk.refTable.length - 1] ?? '', columns: fk.columns, card: cardinality(b, fk),
      });
    }
  }
  for (const r of rels) {
    if (r.status === 'same') continue;
    if (r.status === 'added') summary.relationshipsAdded++; else summary.relationshipsRemoved++;
    const from = byKey.get(r.from)!;
    if (from.status === 'same') from.status = 'changed';
  }
  summary.tablesChanged = entities.filter(e => e.status === 'changed').length;

  const changed = entities.filter(e => e.status !== 'same');
  if (!changed.length) return none;

  // look-alike pairs: a new table whose columns mostly match a dropped one
  const renameHints: string[] = [];
  const takenDropped = new Set<Entity>();
  for (const a of entities.filter(e => e.status === 'added')) {
    const aNames = new Set(a.table.columns.map(c => c.name.toLowerCase()));
    if (!aNames.size) continue;
    let best: Entity | undefined, bestScore = 0;
    for (const d of entities.filter(e => e.status === 'removed' && !takenDropped.has(e))) {
      const dNames = d.table.columns.map(c => c.name.toLowerCase());
      if (!dNames.length) continue;
      const common = dNames.filter(n => aNames.has(n)).length;
      const score = common / Math.max(aNames.size, dNames.length);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    if (best && bestScore >= 0.8) {
      takenDropped.add(best);
      a.renamedFrom = best.table.name;
      renameHints.push(`${a.table.name} looks like a rename of ${best.table.name} (${Math.round(bestScore * 100)}% of columns match).`);
    }
  }

  // which tables to draw
  let shown: Entity[];
  if (scope === 'all') shown = entities;
  else {
    const changedKeys = new Set(changed.map(e => e.key));
    const keep = new Set(changedKeys);
    for (const r of rels) {
      if (!r.to) continue;
      if (changedKeys.has(r.from)) keep.add(r.to);
      if (changedKeys.has(r.to)) keep.add(r.from);
    }
    shown = entities.filter(e => keep.has(e.key));
  }
  let capped = false;
  if (shown.length > max) {
    // changed tables first, then neighbours
    shown = [...shown.filter(e => e.status !== 'same'), ...shown.filter(e => e.status === 'same')].slice(0, max);
    capped = true;
  }
  const shownKeys = new Set(shown.map(e => e.key));

  // schema-qualify a name shared by two schemas anywhere in the input, so ids stay the same in both scopes
  const nameCount = new Map<string, number>();
  for (const e of entities) nameCount.set(e.table.name.toLowerCase(), (nameCount.get(e.table.name.toLowerCase()) ?? 0) + 1);
  const ids = uniqueIds(shown.map(e => (e.table.schema && nameCount.get(e.table.name.toLowerCase())! > 1 ? `${e.table.schema}_${e.table.name}` : e.table.name)), mermaidId);
  const idOf = new Map(shown.map((e, i) => [e.key, ids[i]]));

  const lines = ['erDiagram', `    %% ${DDL_CHANGE_LEGEND.replace(/%/g, '')}`];
  for (const e of shown) {
    const id = idOf.get(e.key)!;
    const label =
      e.status === 'added' ? `+ ${id} (new${e.renamedFrom ? `, was ${mermaidId(e.renamedFrom)}?` : ''})`
      : e.status === 'removed' ? `− ${id} (dropped)`
      : e.status === 'changed' ? `~ ${id} (changed)` : '';
    const rows: string[] = [];
    const oldCols = e.status === 'changed' || e.status === 'same' ? e.before!.columns : [];
    const removedCols = oldCols.filter(o => !e.table.columns.some(c => c.name.toLowerCase() === o.name.toLowerCase()));
    const colIds = uniqueIds([...e.table.columns, ...removedCols].map(c => c.name), mermaidId);
    e.table.columns.forEach((c, i) => {
      const keys = [c.pk ? 'PK' : '', c.fk ? 'FK' : '', c.unique && !c.pk ? 'UK' : ''].filter(Boolean).join(', ');
      let note = '';
      if (e.status === 'changed') {
        const old = oldCols.find(o => o.name.toLowerCase() === c.name.toLowerCase());
        if (!old) note = '+ added';
        else if (normType(old.type) !== normType(c.type)) note = `~ type: ${safeText(old.type || 'none', 28)} → ${safeText(c.type || 'none', 28)}`;
      }
      rows.push(`        ${mermaidType(c.type)} ${colIds[i]}${keys ? ' ' + keys : ''}${note ? ` "${note}"` : ''}`);
    });
    removedCols.forEach((c, i) => rows.push(`        ${mermaidType(c.type)} ${colIds[e.table.columns.length + i]} "− removed"`));
    lines.push(`    ${id}${label ? `["${label}"]` : ''} {`, ...rows, '    }');
  }

  let relCount = 0;
  for (const r of rels) {
    if (!shownKeys.has(r.from) || (r.to && !shownKeys.has(r.to))) continue;
    if (relCount >= max) { capped = true; break; }
    relCount++;
    const target = r.to ? idOf.get(r.to)! : mermaidId(r.toRaw);
    const cols = r.columns.map(mermaidId).join(', ');
    const mark = r.status === 'added' ? '+ ' : r.status === 'removed' ? '− ' : '';
    const card = r.status === 'removed' ? r.card.replace('--', '..') : r.card;
    lines.push(`    ${idOf.get(r.from)} ${card} ${target} : "${mark}${cols}"`);
  }

  const cls = (s: Status) => shown.filter(e => e.status === s).map(e => idOf.get(e.key)!);
  const styles: [Status, string][] = [
    ['added', 'fill:#16a34a33,stroke:#16a34a,stroke-width:2px'],
    ['removed', 'fill:#dc262633,stroke:#dc2626,stroke-width:2px'],
    ['changed', 'fill:#d9770633,stroke:#d97706,stroke-width:2px'],
  ];
  for (const [s, css] of styles) {
    const list = cls(s);
    if (!list.length) continue;
    lines.push(`    classDef ${s} ${css}`, `    class ${list.join(',')} ${s}`);
  }

  return { source: lines.join('\n') + '\n', summary, renameHints, capped, shownTables: shown.length, totalTables: entities.length };
}
