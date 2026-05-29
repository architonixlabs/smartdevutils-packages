export interface GanttMilestone {
  title: string;
  start: string;
  end: string;
  section?: string;
}

export interface VelocityStats {
  average: number;
  trend: 'improving' | 'declining' | 'stable';
  predicted: number;
  min: number;
  max: number;
}

export interface BoundaryCase {
  label: string;
  value: number | string;
  type: 'below-min' | 'at-min' | 'just-above-min' | 'nominal' | 'just-below-max' | 'at-max' | 'above-max';
}

export interface PercentileResult {
  actual: Record<string, number>;
  withinSla: Record<string, boolean>;
  breachedCount: number;
}

export function generateGanttMermaid(milestones: GanttMilestone[]): string {
  const grouped: Record<string, GanttMilestone[]> = {};
  for (const m of milestones) {
    const key = m.section ?? 'Tasks';
    if (!grouped[key]) { grouped[key] = []; }
    grouped[key].push(m);
  }
  const sections: string[] = [];
  for (const [section, items] of Object.entries(grouped)) {
    sections.push(`    section ${section}`);
    for (const item of items) {
      sections.push(`    ${item.title} : ${item.start}, ${item.end}`);
    }
  }
  return `gantt\n    title Project Timeline\n    dateFormat  YYYY-MM-DD\n${sections.join('\n')}`;
}

export function computeVelocityStats(points: number[]): VelocityStats {
  if (points.length === 0) { return { average: 0, trend: 'stable', predicted: 0, min: 0, max: 0 }; }
  const average = points.reduce((a, b) => a + b, 0) / points.length;
  const min = Math.min(...points);
  const max = Math.max(...points);
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (points.length >= 2) {
    const firstHalf = points.slice(0, Math.floor(points.length / 2));
    const secondHalf = points.slice(Math.ceil(points.length / 2));
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (secondAvg > firstAvg * 1.1) { trend = 'improving'; }
      else if (secondAvg < firstAvg * 0.9) { trend = 'declining'; }
    }
  }
  return { average: Math.round(average * 10) / 10, trend, predicted: Math.round(average), min, max };
}

export function computeBoundaryValues(field: { type: 'integer' | 'decimal'; min: number; max: number }): BoundaryCase[] {
  const step = field.type === 'integer' ? 1 : 0.01;
  const nominal = Math.round((field.min + field.max) / 2);
  return [
    { label: 'Below minimum', value: field.min - step, type: 'below-min' },
    { label: 'At minimum', value: field.min, type: 'at-min' },
    { label: 'Just above minimum', value: field.min + step, type: 'just-above-min' },
    { label: 'Nominal (middle)', value: nominal, type: 'nominal' },
    { label: 'Just below maximum', value: field.max - step, type: 'just-below-max' },
    { label: 'At maximum', value: field.max, type: 'at-max' },
    { label: 'Above maximum', value: field.max + step, type: 'above-max' },
  ];
}

export function computePercentiles(times: number[], targets: Record<string, number>): PercentileResult {
  const sorted = [...times].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  };
  const actual: Record<string, number> = {};
  const withinSla: Record<string, boolean> = {};
  for (const [key, target] of Object.entries(targets)) {
    const pNum = parseInt(key.replace('p', ''), 10);
    actual[key] = percentile(pNum);
    withinSla[key] = actual[key] <= target;
  }
  const maxTarget = Math.max(...Object.values(targets));
  const breachedCount = times.filter(t => t > maxTarget).length;
  return { actual, withinSla, breachedCount };
}
