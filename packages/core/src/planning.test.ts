import { describe, it, expect } from 'vitest';
import { generateGanttMermaid, computeVelocityStats, computeBoundaryValues, computePercentiles } from './planning';

describe('generateGanttMermaid', () => {
  it('generates valid Mermaid gantt syntax', () => {
    const milestones = [
      { title: 'Design', start: '2024-01-01', end: '2024-01-07', section: 'Phase 1' },
      { title: 'Build', start: '2024-01-08', end: '2024-01-21', section: 'Phase 1' },
    ];
    const result = generateGanttMermaid(milestones);
    expect(result).toContain('gantt');
    expect(result).toContain('Design');
    expect(result).toContain('Build');
  });
});

describe('computeVelocityStats', () => {
  it('computes average velocity', () => {
    const r = computeVelocityStats([10, 12, 8, 14, 11]);
    expect(r.average).toBeCloseTo(11, 0);
  });

  it('detects improving trend', () => {
    const r = computeVelocityStats([5, 8, 11, 14, 17]);
    expect(r.trend).toBe('improving');
  });

  it('detects declining trend', () => {
    const r = computeVelocityStats([17, 14, 11, 8, 5]);
    expect(r.trend).toBe('declining');
  });

  it('handles single sprint', () => {
    const r = computeVelocityStats([10]);
    expect(r.average).toBe(10);
    expect(r.trend).toBe('stable');
  });
});

describe('computeBoundaryValues', () => {
  it('generates 7 test cases for integer range', () => {
    const cases = computeBoundaryValues({ type: 'integer', min: 1, max: 100 });
    expect(cases.length).toBe(7);
    expect(cases.some(c => c.value === 0)).toBe(true);
    expect(cases.some(c => c.value === 1)).toBe(true);
    expect(cases.some(c => c.value === 100)).toBe(true);
    expect(cases.some(c => c.value === 101)).toBe(true);
  });
});

describe('computePercentiles', () => {
  it('computes p50, p95, p99', () => {
    const times = Array.from({ length: 100 }, (_, i) => i + 1);
    const r = computePercentiles(times, { p50: 50, p95: 95, p99: 99 });
    expect(r.actual.p50).toBeCloseTo(50, 0);
    expect(r.actual.p95).toBeCloseTo(95, 0);
    expect(r.withinSla.p50).toBe(true);
  });
});
