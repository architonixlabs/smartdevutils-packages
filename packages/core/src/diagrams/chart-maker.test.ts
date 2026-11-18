import { describe, it, expect } from 'vitest';
import {
  CAPS, ChartMapping, ChartTable, buildChart, csvField, defaultMapping, detectFormat, formatNumber, isDateLike, niceCeil,
  parseNumber, parseTable, profileColumns, quadrantScale, quoteLabel, rawText, statusLine, suggestChart, toAscii,
} from './chart-maker';

const table = (text: string, ...rest: Parameters<typeof parseTable> extends [string, ...infer R] ? R : never): ChartTable => {
  const t = parseTable(text, ...rest);
  if ('error' in t) throw new Error(t.error);
  return t;
};
const map = (p: Partial<ChartMapping> = {}): ChartMapping => ({ label: 0, values: [1], target: 1, x: 1, y: 2, parent: -1, ...p });
const HOSTILE = 'A "quoted": b, c; d %% e {f} <script>alert(1)</script>\nnext #35; line';

describe('parseNumber', () => {
  it('reads plain, grouped, currency, percent and accounting numbers', () => {
    expect(parseNumber('1234.5')).toBe(1234.5);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('$1,240,000')).toBe(1240000);
    expect(parseNumber('€ 12.50')).toBe(12.5);
    expect(parseNumber('USD 99')).toBe(99);
    expect(parseNumber('99 EUR')).toBe(99);
    expect(parseNumber('64.5%')).toBe(64.5);
    expect(parseNumber('(1,200)')).toBe(-1200);
    expect(parseNumber('-$5')).toBe(-5);
    expect(parseNumber('−3')).toBe(-3);
    expect(parseNumber('1 234 567')).toBe(1234567);
    expect(parseNumber('1e3')).toBe(1000);
  });
  it('follows the chosen number format', () => {
    expect(parseNumber('1.234,5', 'dot')).toBe(1234.5);
    expect(parseNumber('48,50', 'dot')).toBe(48.5);
    expect(parseNumber('1.5', 'dot')).toBeNull();
    expect(parseNumber('1,5', 'comma')).toBeNull();
    expect(parseNumber('1,234', 'none')).toBeNull();
    expect(parseNumber('1234', 'none')).toBe(1234);
  });
  it('rejects text, blanks and hex', () => {
    for (const v of ['', '  ', 'abc', 'n/a', 'N/A', '12abc', '0x1F', 'Infinity', '$', '%']) expect(parseNumber(v), v).toBeNull();
  });
});

describe('formatNumber and niceCeil', () => {
  it('never writes exponents and rounds to 6 decimals', () => {
    expect(formatNumber(1e21)).toBe('1000000000000000000000');
    expect(formatNumber(0.0000001)).toBe('0');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(-2.5)).toBe('-2.5');
    expect(formatNumber(NaN)).toBe('0');
  });
  it('rounds axis maxima up to tidy values', () => {
    expect(niceCeil(1980)).toBe(2000);
    expect(niceCeil(1240000)).toBe(2000000);
    expect(niceCeil(412)).toBe(500);
    expect(niceCeil(230)).toBe(250);
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(0.37)).toBe(0.5);
    expect(niceCeil(0)).toBe(0);
  });
});

describe('escaping', () => {
  it('quoted labels lose double quotes, line breaks, %% and entity codes', () => {
    const q = quoteLabel(HOSTILE);
    expect(q.startsWith('"') && q.endsWith('"')).toBe(true);
    const inner = q.slice(1, -1);
    expect(inner).not.toContain('"');
    expect(inner).not.toContain('\n');
    expect(inner).not.toContain('%%');
    expect(inner).not.toMatch(/#\w+;/);
    expect(inner).toContain("A 'quoted': b, c; d % e {f} <script>");
    expect(quoteLabel('')).toBe('"(blank)"');
    expect(quoteLabel('%%%%')).toBe('"%"');
  });
  it('cuts very long labels', () => {
    expect(quoteLabel('x'.repeat(500)).length).toBeLessThanOrEqual(82);
  });
  it('raw titles and CSV fields', () => {
    expect(rawText('Sales "Q1"\nnotes %% x')).toBe("Sales 'Q1' notes % x");
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField('')).toBe('"(blank)"');
  });
});

describe('detectFormat and parseTable', () => {
  it('detects each format', () => {
    expect(detectFormat('a,b\n1,2')).toBe('csv');
    expect(detectFormat('a\tb\n1\t2')).toBe('tsv');
    expect(detectFormat('a;b\n1;2,5')).toBe('semicolon');
    expect(detectFormat('| a | b |\n|---|---:|\n| x | 1 |')).toBe('markdown');
    expect(detectFormat('[{"a":1}]')).toBe('json');
    expect(detectFormat('Chrome: 64.5\nEdge: 1,234.5')).toBe('lines');
    expect(detectFormat('Browser: Share\nChrome: 64.5')).toBe('lines');
    expect(detectFormat('Chrome 64\nSafari 18')).toBe('lines');
    expect(detectFormat('time,v\n2025-01-01 10:00,5\n2025-01-01 11:00,6')).toBe('csv');
    expect(detectFormat('[not json')).not.toBe('json');
  });
  it('reads CSV with quotes and a header', () => {
    const t = table('name,value\n"Smith, J",10\n"say ""hi""",2');
    expect(t.headers).toEqual(['name', 'value']);
    expect(t.rows).toEqual([['Smith, J', '10'], ['say "hi"', '2']]);
    expect(t.hasHeader).toBe(true);
  });
  it('header detection and overrides', () => {
    expect(table('a,1\nb,2').hasHeader).toBe(false);
    expect(table('a,1\nb,2').headers).toEqual(['Column 1', 'Column 2']);
    expect(table('a,1\nb,2', 'auto', 'yes').headers).toEqual(['a', '1']);
    expect(table('x,y\nb,2', 'auto', 'no').rows.length).toBe(2);
    // Years as series names
    const y = table('Region,2024,2025\nNorth,120,140\nSouth,90,95');
    expect(y.hasHeader).toBe(true);
    expect(y.headers).toEqual(['Region', '2024', '2025']);
    // A data row of years is not a header
    expect(table('Year,Sales\n2024,10').hasHeader).toBe(true);
    expect(table('2023,10\n2024,12').hasHeader).toBe(false);
  });
  it('reads Markdown tables, including escaped pipes', () => {
    const t = table('| Name | Size |\n| :--- | ---: |\n| a \\| b | 3 |\n| c | 4 |');
    expect(t.format).toBe('markdown');
    expect(t.headers).toEqual(['Name', 'Size']);
    expect(t.rows).toEqual([['a | b', '3'], ['c', '4']]);
  });
  it('reads JSON objects, pairs, label maps and wrappers', () => {
    const o = table('[{"r":"N","v":1},{"r":"S","v":2.5,"extra":true}]');
    expect(o.headers).toEqual(['r', 'v', 'extra']);
    expect(o.rows[1]).toEqual(['S', '2.5', 'true']);
    const p = table('[["a", 1], ["b", 2]]');
    expect(p.hasHeader).toBe(false);
    expect(p.rows).toEqual([['a', '1'], ['b', '2']]);
    const m = table('{"a": 1, "b": 2}');
    expect(m.headers).toEqual(['Label', 'Value']);
    expect(m.rows).toEqual([['a', '1'], ['b', '2']]);
    const w = table('{"data": [{"k":"x","n":3}]}');
    expect(w.headers).toEqual(['k', 'n']);
    // JSON numbers follow the decimal-comma setting so they still read as numbers
    const d = table('[{"k":"x","n":1.5}]', 'auto', 'auto', 'dot');
    expect(parseNumber(d.rows[0][1], 'dot')).toBe(1.5);
  });
  it('reports bad JSON and empty input', () => {
    expect(parseTable('[{"a":1}', 'json')).toEqual({ error: expect.stringContaining('not valid JSON') });
    expect(parseTable('[]', 'json')).toEqual({ error: 'The JSON array is empty.' });
    expect(parseTable('"x"', 'json')).toEqual({ error: expect.stringContaining('must be an array') });
    expect(parseTable('   ')).toEqual({ error: 'Paste some data first.' });
  });
  it('reads label: value and label value lines', () => {
    const t = table('Chrome: 64.5%\nSamsung Internet: 2.4%\nOther = 3');
    expect(t.rows).toEqual([['Chrome', '64.5%'], ['Samsung Internet', '2.4%'], ['Other', '3']]);
    expect(table('New York 120\nLos Angeles 95').rows).toEqual([['New York', '120'], ['Los Angeles', '95']]);
  });
  it('pads short rows and names duplicate headers', () => {
    const t = table('a,a,b\nx,1\ny,2,3');
    expect(t.headers).toEqual(['a', 'a (2)', 'b']);
    expect(t.rows[0]).toEqual(['x', '1', '']);
  });
  it('reads semicolon files with decimal commas', () => {
    const t = table('Q;Orders\nQ1;1.240,5', 'auto', 'auto', 'dot');
    expect(t.format).toBe('semicolon');
    expect(parseNumber(t.rows[0][1], 'dot')).toBe(1240.5);
  });
});

describe('profiles, suggestions and default columns', () => {
  const sugg = (text: string) => { const t = table(text); return suggestChart(t, profileColumns(t))?.type; };
  it('recognises dates and periods', () => {
    for (const v of ['2025-01', '2025-01-31', 'Jan', 'January 2025', 'Q1 2025', '2024', '12/31/2025', 'Week 3', 'Mon']) expect(isDateLike(v), v).toBe(true);
    for (const v of ['Chrome', 'North America', '12.5', '']) expect(isDateLike(v), v).toBe(false);
  });
  it('profiles column kinds', () => {
    const t = table('Month,Signups,Note\nJan,10,a\nFeb,12,b');
    expect(profileColumns(t).map(p => p.kind)).toEqual(['date', 'number', 'text']);
  });
  it('suggests a chart type from the data shape', () => {
    expect(sugg('Browser,Share\nChrome,64\nSafari,18\nEdge,5')).toBe('pie');
    expect(sugg('City,Pop\n' + Array.from({ length: 12 }, (_, i) => `C${i},${i + 1}`).join('\n'))).toBe('bar');
    expect(sugg('Product,Tickets\n' + Array.from({ length: 12 }, (_, i) => `A product with a long name ${i},${i}`).join('\n'))).toBe('hbar');
    expect(sugg('Month,Signups\n2025-01,10\n2025-02,12')).toBe('line');
    expect(sugg('source,target,amount\nA,B,1\nB,C,2')).toBe('sankey');
    expect(sugg('Feature,Effort,Impact\nA,2,6\nB,8,9')).toBe('quadrant');
    expect(sugg('Skill,Asha,Ben\nTS,5,3\nSQL,3,5\nTesting,4,4')).toBe('radar');
    expect(sugg('path,mb\na/b,1\na/c,2\nd,3')).toBe('treemap');
    expect(sugg('Region,Q1,Q2\nN,1200,1300\nS,900,950\nE,800,700\nW,100,50')).toBe('line');
    expect(sugg('a,b\nx,y')).toBeUndefined();
  });
  it('picks a label column and number columns', () => {
    const t = table('id,name,score,other\n1,a,2,3');
    // id is numeric, so name is the first non-number column
    const m = defaultMapping(profileColumns(t));
    expect(m.label).toBe(1);
    expect(m.values).toEqual([0, 2, 3]);
    const s = defaultMapping(profileColumns(table('source,target,amount\nA,B,1')));
    expect([s.label, s.target, s.values[0]]).toEqual([0, 1, 2]);
  });
});

describe('pie', () => {
  it('builds pie text with title, showData and summed duplicates', () => {
    const t = table('Browser,Share\nChrome,60\nSafari,30\nChrome,5\nBad,n/a');
    const r = buildChart('pie', t, map(), { title: 'Share: 2025' });
    expect(r.error).toBeNull();
    expect(r.mermaid).toBe('pie showData\n    title Share: 2025\n    "Chrome" : 65\n    "Safari" : 30');
    expect(r.skippedRows).toEqual([4]);
    expect(r.notes.join(' ')).toContain('added together');
    expect(statusLine(t, r)).toContain('Skipped 1 row without a number: data row 4');
  });
  it('can hide values, sorts and groups the rest as Other', () => {
    const t = table('k,v\na,1\nb,5\nc,3\nd,2\ne,4');
    const r = buildChart('pie', t, map(), { showValues: false, topN: 2, sort: 'asc' });
    expect(r.mermaid).toBe('pie\n    "e" : 4\n    "b" : 5\n    "Other" : 6');
    expect(r.notes.join(' ')).toContain('3 smallest categories were grouped as "Other"');
  });
  it('renames the group when a category is already called Other', () => {
    const t = table('k,v\nOther,9\nb,5\nc,3');
    expect(buildChart('pie', t, map(), { topN: 1 }).mermaid).toBe('pie showData\n    "Other" : 9\n    "Other (rest)" : 8');
  });
  it('skips negative values with a note, and escapes hostile labels', () => {
    const t = table(`k,v\n"${HOSTILE.replace(/"/g, '""')}",3\nneg,-2`);
    const r = buildChart('pie', t, map(), { title: HOSTILE });
    expect(r.mermaid.split('\n')).toHaveLength(3);
    expect(r.mermaid).not.toContain('%%');
    expect(r.mermaid).not.toMatch(/#\w+;/);
    expect(r.notes.join(' ')).toContain('negative');
    expect(r.skippedCount).toBe(0);
  });
  it('caps categories and says so', () => {
    const t = table('k,v\n' + Array.from({ length: 80 }, (_, i) => `c${i},${i + 1}`).join('\n'));
    const r = buildChart('pie', t, map());
    expect(r.items).toBe(CAPS.pie);
    expect(r.notes.join(' ')).toContain(`first ${CAPS.pie} of 80`);
    const top = buildChart('pie', t, map(), { topN: 10 });
    expect(top.items).toBe(11);
  });
  it('uses only the first value column', () => {
    const r = buildChart('pie', table('k,a,b\nx,1,2'), map({ values: [1, 2] }));
    expect(r.notes.join(' ')).toContain('only "a" is used');
  });
  it('errors when nothing is numeric', () => {
    expect(buildChart('pie', table('k,v\na,x\nb,y', 'auto', 'yes'), map()).error).toContain('No rows');
    expect(buildChart('pie', table('k,v\na,1'), map({ values: [] })).error).toBe('Choose a value column.');
    expect(buildChart('pie', table('k,v\na,1'), map({ label: 9 })).error).toBe('Choose a label column.');
  });
});

describe('xychart (bar, horizontal bar, line, bar + line)', () => {
  const t = table('Region,Revenue,Cost\nNorth,"$1,200",800\nSouth,950,700\nEast,400,500');
  it('bar starts the y axis at zero, adds value labels in the front matter', () => {
    const r = buildChart('bar', t, map({ values: [1] }), { title: 'Revenue' });
    expect(r.mermaid).toBe([
      '---', 'config:', '  xyChart:', '    showDataLabel: true', '---',
      'xychart-beta',
      '    title "Revenue"',
      '    x-axis "Region" ["North", "South", "East"]',
      '    y-axis "Revenue" 0 --> 2000',
      '    bar [1200, 950, 400]',
    ].join('\n'));
  });
  it('horizontal bar, no values, sorting', () => {
    const r = buildChart('hbar', t, map(), { showValues: false, sort: 'desc' });
    expect(r.mermaid.startsWith('xychart-beta horizontal\n')).toBe(true);
    expect(r.mermaid).not.toContain('showDataLabel');
  });
  it('draws only one bar series and explains why', () => {
    const r = buildChart('bar', t, map({ values: [1, 2] }));
    expect(r.mermaid.match(/bar \[/g)).toHaveLength(1);
    expect(r.notes.join(' ')).toContain('no stacked or grouped bars');
  });
  it('line: several series, auto range, legend note', () => {
    const r = buildChart('line', t, map({ values: [1, 2] }), { yTitle: 'USD' });
    expect(r.mermaid).toContain('    y-axis "USD"\n');
    expect(r.mermaid).toContain('    line [1200, 950, 400]\n    line [800, 700, 500]');
    expect(r.notes.join(' ')).toContain('no legend. Series in drawing order: line 1: Revenue; line 2: Cost');
  });
  it('line without titles or range has no y-axis line', () => {
    const r = buildChart('line', table('a,1\nb,2'), map());
    expect(r.mermaid).toBe('xychart-beta\n    x-axis ["a", "b"]\n    line [1, 2]');
  });
  it('bar + line', () => {
    const r = buildChart('barline', t, map({ values: [1, 2] }), { showValues: false });
    expect(r.mermaid).toContain('    bar [1200, 950, 400]\n    line [800, 700, 500]');
    expect(r.notes.join(' ')).toContain('bars: Revenue; line 1: Cost');
    expect(buildChart('barline', t, map({ values: [1] })).notes.join(' ')).toContain('second value column');
  });
  it('custom and invalid y ranges, negative values', () => {
    expect(buildChart('line', t, map(), { yMin: 0, yMax: 1500 }).mermaid).toContain('y-axis "Revenue" 0 --> 1500');
    expect(buildChart('line', t, map(), { yMin: 100 }).mermaid).toContain('y-axis "Revenue" 100 --> 1200');
    const bad = buildChart('bar', t, map(), { yMin: 10, yMax: 5 });
    expect(bad.mermaid).toContain('0 --> 2000');
    expect(bad.notes.join(' ')).toContain('range was ignored');
    expect(buildChart('bar', t, map(), { yMax: 1000 }).notes.join(' ')).toContain('outside the y-axis range');
    const neg = buildChart('bar', table('k,v\na,-30\nb,120'), map());
    expect(neg.mermaid).toContain('y-axis "v" -50 --> 200');
  });
  it('escapes hostile categories and titles', () => {
    const h = table(`k,v\n"${HOSTILE.replace(/"/g, '""')}",1`);
    const r = buildChart('bar', h, map(), { title: HOSTILE, xTitle: 'x "y"' });
    const xLine = r.mermaid.split('\n').find(l => l.includes('x-axis'))!;
    expect(xLine).toMatch(/^ {4}x-axis "x 'y'" \["[^"]*"\]$/);
    expect(r.mermaid.split('\n').find(l => l.includes('title'))).toMatch(/^ {4}title "[^"]*"$/);
  });
  it('caps line categories at its limit', () => {
    const big = table('k,v\n' + Array.from({ length: 150 }, (_, i) => `d${i},${i}`).join('\n'));
    expect(buildChart('line', big, map()).items).toBe(CAPS.line);
  });
});

describe('sankey', () => {
  const t = table('src,dst,amt\nBudget,Eng,100\nBudget,Ops,50\nEng,Salaries,80\nBudget,Eng,20\nEng,Eng,5\nOps,Budget,10\nX,Y,0\nA,B,abc');
  it('sums duplicate links, skips self links, loops, zeros and text', () => {
    const r = buildChart('sankey', t, map({ target: 1, values: [2] }), { title: 'ignored' });
    expect(r.mermaid).toBe('sankey-beta\n\n"Budget","Eng",120\n"Budget","Ops",50\n"Eng","Salaries",80');
    const notes = r.notes.join(' ');
    expect(notes).toContain('to itself');
    expect(notes).toContain('cannot show loops');
    expect(notes).toContain('Ops → Budget');
    expect(notes).toContain('zero or negative');
    expect(notes).toContain('does not draw a title');
    expect(r.skippedRows).toEqual([8]);
  });
  it('escapes fields as CSV', () => {
    const h = table(`a,b,v\n"${HOSTILE.replace(/"/g, '""')}","x,y",3`);
    const r = buildChart('sankey', h, map({ target: 1, values: [2] }));
    const line = r.mermaid.split('\n')[2];
    expect(line).toMatch(/^"A ""quoted"": b, c; d % e \{f\} <script>.*","x,y",3$/);
  });
  it('keeps node names in printable ASCII, which is all the sankey grammar reads', () => {
    expect(toAscii('Café – “Zürich” 日本')).toBe("Cafe - 'Zurich' ??");
    const u = table('s,t,v\nCafé,日本,3\nCafé,中国,2');
    const r = buildChart('sankey', u, map({ target: 1, values: [2] }));
    expect(r.mermaid).toBe('sankey-beta\n\n"Cafe","??",3\n"Cafe","?? (2)",2');
    expect(r.mermaid).toMatch(/^[\n\x20-\x7e]*$/);
    expect(r.notes.join(' ')).toContain('only plain ASCII');
  });
  it('caps links at the largest ones', () => {
    const many = table('s,t,v\n' + Array.from({ length: 400 }, (_, i) => `s${i},t${i},${i + 1}`).join('\n'));
    const r = buildChart('sankey', many, map({ target: 1, values: [2] }));
    expect(r.items).toBe(CAPS.sankey);
    expect(r.mermaid).toContain('"s399","t399",400');
    expect(r.mermaid).not.toContain('"s0","t0",1\n');
    expect(r.notes.join(' ')).toContain('300 largest of 400');
  });
  it('needs distinct source and target and a value column', () => {
    expect(buildChart('sankey', t, map({ target: 0, values: [2] })).error).toContain('different source and target');
    expect(buildChart('sankey', t, map({ target: 1, values: [1] })).error).toContain('value column');
  });
});

describe('quadrant', () => {
  it('keeps 0..1 values, divides 0..10 scores, rescales others with padding', () => {
    expect(quadrantScale([0.2, 0.9]).how).toBe('');
    expect(quadrantScale([1, 9]).f(5)).toBe(0.5);
    expect(quadrantScale([10, 90]).f(50)).toBe(0.5);
    const s = quadrantScale([-10, 30]);
    expect(s.f(-10)).toBeCloseTo(0.05);
    expect(s.f(30)).toBeCloseTo(0.95);
    expect(quadrantScale([500, 500]).f(500)).toBe(0.5);
  });
  it('builds the chart with axis names and quadrant names', () => {
    const t = table('Feature,Effort,Impact\nDark mode,2,6\n"SSO: login",8,9\nBad,x,1');
    const r = buildChart('quadrant', t, map({ x: 1, y: 2 }), { title: 'Effort: impact', quadrants: 'Big bets, Quick "wins", , Money pits' });
    expect(r.mermaid).toBe([
      'quadrantChart',
      '    title Effort: impact',
      '    x-axis "Low Effort" --> "High Effort"',
      '    y-axis "Low Impact" --> "High Impact"',
      '    quadrant-1 "Big bets"',
      '    quadrant-2 "Quick \'wins\'"',
      '    quadrant-4 "Money pits"',
      '    "Dark mode": [0.2, 0.6]',
      '    "SSO: login": [0.8, 0.9]',
    ].join('\n'));
    expect(r.skippedRows).toEqual([3]);
    expect(r.notes.join(' ')).toContain('0 to 10 score');
  });
  it('rescales large ranges and caps points', () => {
    const t = table('n,x,y\n' + Array.from({ length: 120 }, (_, i) => `p${i},${i * 100},${-i}`).join('\n'));
    const r = buildChart('quadrant', t, map({ x: 1, y: 2 }), { xTitle: 'Cost' });
    expect(r.items).toBe(CAPS.quadrant);
    expect(r.mermaid).toContain('x-axis "Low Cost" --> "High Cost"');
    expect(r.mermaid).toContain('"p0": [0.05, 0.95]');
    expect(r.notes.join(' ')).toContain('rescaled');
  });
});

describe('radar', () => {
  const t = table('Skill\tAsha\tBen\nTypeScript\t5\t3\nSQL\t3\t5\nTesting\t4\t4');
  it('builds axes and one curve per column', () => {
    const r = buildChart('radar', t, map({ values: [1, 2] }), { title: 'Skills: 2025', yMax: 5 });
    expect(r.mermaid).toBe([
      'radar-beta',
      '    title Skills: 2025',
      '    axis a0["TypeScript"], a1["SQL"], a2["Testing"]',
      '    curve c0["Asha"]{5, 3, 4}',
      '    curve c1["Ben"]{3, 5, 4}',
      '    max 5',
      '    min 0',
    ].join('\n'));
  });
  it('skips negative rows, fixes a negative minimum, warns on too few axes', () => {
    const n = table('k,v\na,1\nb,-1');
    const r = buildChart('radar', n, map(), { yMin: -3 });
    expect(r.mermaid).toContain('min 0');
    expect(r.mermaid).not.toMatch(/-\d/);
    const notes = r.notes.join(' ');
    expect(notes).toContain('negative');
    expect(notes).toContain('minimum must be 0 or more');
    expect(notes).toContain('three or more');
  });
  it('escapes axis and curve labels', () => {
    const h = table(`k,"say ""hi"""\n"${HOSTILE.replace(/"/g, '""')}",1`);
    const r = buildChart('radar', h, map());
    expect(r.mermaid).toMatch(/axis a0\["A 'quoted'[^"]*"\]/);
    expect(r.mermaid).toContain(`curve c0["say 'hi'"]{1}`);
  });
});

describe('treemap', () => {
  it('builds nested boxes from paths', () => {
    const t = table('path,mb\nhome/web/src,40\nhome/web/dist,10\nhome/docs,5\nvar/log,7\nhome/docs,1');
    const r = buildChart('treemap', t, map(), { title: 'Disk: usage' });
    expect(r.mermaid).toBe([
      'treemap-beta',
      '    title Disk: usage',
      '"home"',
      '    "web"',
      '        "src": 40',
      '        "dist": 10',
      '    "docs": 6',
      '"var"',
      '    "log": 7',
    ].join('\n'));
  });
  it('detects other separators and notes values on groups', () => {
    const t = table('p,v\nA > B,3\nA,10\nA > C,2');
    const r = buildChart('treemap', t, map());
    expect(r.mermaid).toBe('treemap-beta\n"A"\n    "B": 3\n    "C": 2');
    expect(r.notes.join(' ')).toContain('children as well as a value');
  });
  it('builds from parent/child columns and cuts loops', () => {
    const t = table('name,parent,size\nweb,projects,5\napi,projects,3\nprojects,home,\nphotos,home,9\nx,y,1\ny,x,2');
    const r = buildChart('treemap', t, map({ label: 0, parent: 1, values: [2] }));
    expect(r.mermaid).toContain('"home"\n    "projects"\n        "web": 5\n        "api": 3\n    "photos": 9');
    expect(r.notes.join(' ')).toContain('loops back');
    expect(r.skippedRows).toEqual([3]);
  });
  it('flat labels get a note; custom separator', () => {
    expect(buildChart('treemap', table('k,v\na,1\nb,2'), map()).notes.join(' ')).toContain('all boxes are on one level');
    const r = buildChart('treemap', table('k,v\na.b,1\na.c,2'), map(), { separator: '.' });
    expect(r.mermaid).toBe('treemap-beta\n"a"\n    "b": 1\n    "c": 2');
  });
  it('escapes names and caps boxes', () => {
    const r = buildChart('treemap', table(`k,v\n"${HOSTILE.replace(/"/g, '""').replace('/', '')}",1`), map(), { separator: '|' });
    expect(r.mermaid.split('\n')[1]).toMatch(/^"A 'quoted': b, c; d % e \{f\} <script>[^"]*": 1$/);
    const big = table('k,v\n' + Array.from({ length: 400 }, (_, i) => `g${i % 5}/n${i},1`).join('\n'));
    const c = buildChart('treemap', big, map());
    expect(c.items).toBe(CAPS.treemap);
    expect(c.notes.join(' ')).toContain('first 300 boxes');
  });
});

describe('statusLine and large input', () => {
  it('describes what was read', () => {
    const t = table('| a | b |\n|---|---|\n| x | 1 |');
    expect(statusLine(t, buildChart('pie', t, map()))).toBe('Read 1 data row and 2 columns as a Markdown table with a header row.');
  });
  it('handles 20 000 rows', () => {
    const big = 'k,v\n' + Array.from({ length: 20000 }, (_, i) => `k${i % 40},${i}`).join('\n');
    const t = table(big);
    const r = buildChart('bar', t, map());
    expect(r.items).toBe(40);
    expect(r.error).toBeNull();
  });
  it('refuses input over 2 MB', () => {
    expect(parseTable('x'.repeat(2_000_001))).toEqual({ error: expect.stringContaining('larger than 2 MB') });
  });
});
