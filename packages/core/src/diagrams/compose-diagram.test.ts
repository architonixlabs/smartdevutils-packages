import { describe, it, expect } from 'vitest';
import { composeTextToMermaid, portMapping, namedVolumeOf } from './compose-diagram';

const WEB_DB = `services:
  web:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
      - "127.0.0.1:8443:443/udp"
      - "9000"
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
        required: false
    networks: [front, back]
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d
    networks: [back]
  cache:
    image: redis:7
    profiles: [cache]
networks:
  front: {}
  back: {}
volumes:
  pgdata: {}
`;

describe('composeTextToMermaid', () => {
  it('returns nothing for empty, invalid or service-less input', () => {
    expect(composeTextToMermaid('').mermaid).toBe('');
    expect(composeTextToMermaid('services: [').mermaid).toBe('');
    expect(composeTextToMermaid('version: "3"').mermaid).toBe('');
    expect(composeTextToMermaid('services: {}').mermaid).toBe('');
  });

  it('draws services, conditions, ports, networks and volumes', () => {
    const d = composeTextToMermaid(WEB_DB);
    const m = d.mermaid;
    expect(m.startsWith('flowchart LR')).toBe(true);
    expect(d.services).toBe(3);
    expect(d.problems).toEqual([]);
    expect(m).toContain('s0 -->|"service_healthy"| s1');
    expect(m).toContain('s0 -.->|"service_started, optional"| s2');
    expect(m).toContain('host -->|"8080 → 80, 127.0.0.1:8443 → 443/udp"| s0');
    expect(m).toContain('port 9000 (no host port)');
    expect(m).toMatch(/subgraph n1\["network: back"\]\n {4}s1\(/);
    // web is on two networks: outside the boxes, linked to both
    expect(m).toContain('s0 -.- n0');
    expect(m).toContain('s0 -.- n1');
    expect(m).toContain('v0[("pgdata")]');
    expect(m).toContain('s1 ---|"/var/lib/postgresql/data"| v0');
    expect(m).toContain('1 bind mount');
    expect(m).toContain('profiles: cache');
  });

  it('marks depends_on cycles in red', () => {
    const d = composeTextToMermaid('services:\n  a:\n    image: x\n    depends_on: [b]\n  b:\n    image: y\n    depends_on: [a]\n  c:\n    image: z\n    depends_on: [a]');
    expect(d.problems).toEqual(['Dependency cycle: a → b → a. Compose cannot start these services.']);
    expect(d.mermaid).toContain('s0("a<br/>x"):::problem');
    expect(d.mermaid).toContain('linkStyle 0,1 stroke:#dc2626');
    expect(d.mermaid).not.toMatch(/linkStyle [\d,]*2/);
  });

  it('shows depends_on to an unknown service as a dashed red node', () => {
    const d = composeTextToMermaid('services:\n  api:\n    image: x\n    depends_on:\n      - redis');
    expect(d.problems[0]).toContain('"redis"');
    expect(d.mermaid).toContain('m0["redis<br/>not a service in this file"]:::missing');
    expect(d.mermaid).toContain('s0 -.->|"not defined"| m0');
  });

  it('notes extends, network_mode and undeclared volumes', () => {
    const d = composeTextToMermaid(`services:
  base:
    image: x
  app:
    extends: base
    network_mode: "service:base"
  job:
    extends: { service: common, file: common.yml }
    network_mode: host
    volumes: [cache:/c]
`);
    expect(d.mermaid).toContain('s1 -.->|"extends"| s0');
    expect(d.mermaid).toContain('s1 -.->|"shares network"| s0');
    expect(d.mermaid).toContain('extends: common (common.yml)');
    expect(d.mermaid).toContain('network_mode: host');
    expect(d.mermaid).toContain('v0[("cache<br/>not in top-level volumes")]:::warn');
  });

  it('escapes hostile service names and images', () => {
    const d = composeTextToMermaid(`services:
  "evil\\"; click s0 call alert() %%":
    image: "<script>alert(1)</script>"
    depends_on: ["x{y}[z]|w"]
`);
    const labels = d.mermaid.split('\n').filter(l => /^\s+(s0|m0)\b/.test(l)).join('\n');
    expect(labels).not.toContain('<script>');
    expect(labels).not.toContain('%%');
    expect(d.mermaid).toContain('#60;script#62;');
    expect(d.mermaid).toContain('#123;y#125;#91;z#93;#124;w');
  });

  it('caps very large files and says so', () => {
    const svc = Array.from({ length: 400 }, (_, i) => `  s${i}:\n    image: x\n    depends_on: [s${i + 1 === 400 ? 0 : i + 1}]`).join('\n');
    const d = composeTextToMermaid(`services:\n${svc}`, 300);
    expect(d.truncated).toBe(true);
    expect(d.services).toBe(300);
    expect((d.mermaid.match(/^\s+s\d+\(/gm) ?? []).length).toBe(300);
  });
});

describe('port and volume helpers', () => {
  it('reads short and long port syntax', () => {
    expect(portMapping('80')).toEqual({ host: null, container: '80' });
    expect(portMapping('8080:80/tcp')).toEqual({ host: '8080', container: '80' });
    expect(portMapping('[::1]:8080:80')).toEqual({ host: '[::1]:8080', container: '80' });
    expect(portMapping({ target: 80, published: 8080, protocol: 'udp' })).toEqual({ host: '8080', container: '80/udp' });
    expect(portMapping({ target: 80 })).toEqual({ host: null, container: '80' });
  });

  it('tells named volumes from bind mounts', () => {
    expect(namedVolumeOf('data:/x')).toBe('data');
    expect(namedVolumeOf('./data:/x')).toBeNull();
    expect(namedVolumeOf('C:\\data:/x')).toBeNull();
    expect(namedVolumeOf({ type: 'bind', source: 'x' })).toBeNull();
  });
});
