import { describe, it, expect } from 'vitest';
import { envToJson, cidrExpand } from './devops';

describe('envToJson', () => {
  it('parses key=value pairs', () => {
    expect(envToJson('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });
  it('ignores comment lines', () => {
    const r = envToJson('# comment\nKEY=value');
    expect(r).not.toHaveProperty('#');
    expect(r.KEY).toBe('value');
  });
  it('strips surrounding quotes', () => {
    expect(envToJson('SECRET="my secret"').SECRET).toBe('my secret');
  });
  it('ignores blank lines', () => {
    expect(Object.keys(envToJson('\nFOO=1\n\nBAR=2\n'))).toHaveLength(2);
  });
});

describe('cidrExpand', () => {
  it('expands /24', () => {
    const r = cidrExpand('192.168.1.0/24');
    expect(r.network).toBe('192.168.1.0');
    expect(r.broadcast).toBe('192.168.1.255');
    expect(r.hosts).toBe(254);
    expect(r.prefix).toBe(24);
  });
  it('expands /30', () => {
    const r = cidrExpand('10.0.0.0/30');
    expect(r.hosts).toBe(2);
    expect(r.broadcast).toBe('10.0.0.3');
  });
  it('handles /32', () => {
    const r = cidrExpand('10.0.0.1/32');
    expect(r.hosts).toBe(0);
    expect(r.network).toBe('10.0.0.1');
  });
  it('throws on invalid CIDR', () => {
    expect(() => cidrExpand('not-a-cidr')).toThrow();
  });
});
