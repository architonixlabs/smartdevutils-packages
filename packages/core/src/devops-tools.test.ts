import { describe, it, expect } from 'vitest';
import { generateCicdPipeline, detectUnpinnedDockerImages, parseLogLines, validateK8sManifest } from './devops-tools';

describe('generateCicdPipeline', () => {
  it('generates GitHub Actions YAML for Node', () => {
    const yaml = generateCicdPipeline({ language: 'node', platform: 'github-actions', steps: ['install', 'test'] });
    expect(yaml).toContain('on:');
    expect(yaml).toContain('npm install');
    expect(yaml).toContain('npm test');
  });

  it('generates GitLab CI for Python', () => {
    const yaml = generateCicdPipeline({ language: 'python', platform: 'gitlab-ci', steps: ['install', 'test'] });
    expect(yaml).toContain('pip install');
  });
});

describe('detectUnpinnedDockerImages', () => {
  it('detects :latest tag', () => {
    const results = detectUnpinnedDockerImages('FROM node:latest\nFROM nginx:latest');
    expect(results.filter(r => r.status === 'unpinned').length).toBeGreaterThan(0);
  });

  it('marks pinned digest as pinned', () => {
    const results = detectUnpinnedDockerImages('FROM node:18.19.0@sha256:abc123def456');
    expect(results.some(r => r.status === 'pinned')).toBe(true);
  });

  it('marks versioned tag as versioned', () => {
    const results = detectUnpinnedDockerImages('FROM node:18.19.0');
    expect(results.some(r => r.status === 'versioned')).toBe(true);
  });
});

describe('parseLogLines', () => {
  it('parses JSON log lines', () => {
    const lines = '{"timestamp":"2024-01-01T00:00:00Z","level":"INFO","message":"started"}';
    const parsed = parseLogLines(lines);
    expect(parsed[0].level).toBe('INFO');
    expect(parsed[0].message).toBe('started');
  });

  it('parses syslog-style lines', () => {
    const lines = 'Jan 01 00:00:00 host myapp[123]: started';
    const parsed = parseLogLines(lines);
    expect(parsed[0].message).toBeTruthy();
  });
});

describe('validateK8sManifest', () => {
  it('passes valid Deployment manifest', () => {
    const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: myapp\nspec:\n  replicas: 2\n  template:\n    spec:\n      containers:\n      - name: app\n        image: myapp:1.0.0\n        resources:\n          limits:\n            memory: 128Mi`;
    const result = validateK8sManifest(yaml);
    expect(result.errors).toHaveLength(0);
  });

  it('warns on :latest image', () => {
    const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: myapp\nspec:\n  replicas: 1\n  template:\n    spec:\n      containers:\n      - name: app\n        image: myapp:latest`;
    const result = validateK8sManifest(yaml);
    expect(result.warnings.some(w => w.includes('latest'))).toBe(true);
  });

  it('errors on missing apiVersion', () => {
    const yaml = `kind: Deployment\nmetadata:\n  name: myapp`;
    const result = validateK8sManifest(yaml);
    expect(result.errors.some(e => e.includes('apiVersion'))).toBe(true);
  });
});
