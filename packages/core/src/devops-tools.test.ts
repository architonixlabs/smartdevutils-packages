import { describe, it, expect } from 'vitest';
import { generateCicdPipeline, detectUnpinnedDockerImages, parseLogLines, validateK8sManifest } from './devops-tools';
import { loadYaml } from './yaml';
const yaml = { load: loadYaml };

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

describe('generateCicdPipeline (1.2.0 fixes)', () => {
  const languages = ['node', 'python', 'go', 'java', 'dotnet', 'rust'] as const;
  const platforms = ['github-actions', 'gitlab-ci', 'circleci', 'azure-pipelines'] as const;
  const allSteps = ['install', 'lint', 'test', 'build', 'docker', 'deploy'] as const;

  it('emits YAML that parses for every platform x language with all steps', () => {
    for (const platform of platforms) {
      for (const language of languages) {
        const out = generateCicdPipeline({ language, platform, steps: [...allSteps] });
        const doc = yaml.load(out);
        expect(doc, `${platform}/${language}`).toBeTypeOf('object');
        expect(doc).not.toBeNull();
      }
    }
  });

  it('never emits placeholder step names as commands', () => {
    for (const platform of platforms) {
      for (const language of languages) {
        const out = generateCicdPipeline({ language, platform, steps: [...allSteps] });
        expect(out).not.toMatch(/(run|script|command):\s*(lint|docker|deploy)\s*$/m);
        // Collect every command string (run / script / command) from the parsed document.
        const cmds: string[] = [];
        const walk = (n: unknown, key?: string): void => {
          if (Array.isArray(n)) n.forEach(x => walk(x, key));
          else if (n && typeof n === 'object') Object.entries(n).forEach(([k, v]) => walk(v, k));
          else if (typeof n === 'string' && ['run', 'script', 'command'].includes(key ?? '')) cmds.push(n);
        };
        walk(yaml.load(out));
        expect(cmds.length, `${platform}/${language}`).toBeGreaterThan(4);
        for (const c of cmds) expect(['install', 'test', 'lint', 'build', 'docker', 'deploy']).not.toContain(c);
      }
    }
  });

  it('github-actions: adds actions/setup-node and real lint/docker/deploy steps for node', () => {
    const out = generateCicdPipeline({ language: 'node', platform: 'github-actions', steps: [...allSteps] });
    const doc = yaml.load(out) as any;
    const steps = doc.jobs.build.steps as any[];
    expect(steps.some(s => typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node@'))).toBe(true);
    expect(steps.some(s => s.run === 'npm run lint')).toBe(true);
    expect(steps.some(s => typeof s.run === 'string' && s.run.startsWith('docker build'))).toBe(true);
    expect(doc.jobs.deploy.needs).toBe('build');
    expect(doc.jobs.deploy.if).toContain('refs/heads/main');
    expect(doc.on).toBeDefined();
  });

  it('github-actions: uses the matching setup action per language', () => {
    const expected: Record<string, string> = {
      python: 'actions/setup-python@', go: 'actions/setup-go@', java: 'actions/setup-java@', dotnet: 'actions/setup-dotnet@',
    };
    for (const [language, action] of Object.entries(expected)) {
      const doc = yaml.load(generateCicdPipeline({ language: language as any, platform: 'github-actions', steps: ['install', 'test'] })) as any;
      expect(doc.jobs.build.steps.some((s: any) => typeof s.uses === 'string' && s.uses.startsWith(action)), language).toBe(true);
    }
  });

  it('gitlab-ci: sets a language image and a docker-in-docker job', () => {
    const doc = yaml.load(generateCicdPipeline({ language: 'python', platform: 'gitlab-ci', steps: [...allSteps] })) as any;
    expect(doc.build.image).toMatch(/^python:/);
    expect(doc.docker.services[0]).toMatch(/dind/);
    expect(doc.stages).toEqual(['build', 'docker', 'deploy']);
    expect(doc.deploy.rules[0].if).toContain('CI_DEFAULT_BRANCH');
  });

  it('azure-pipelines: emits trigger/pool/steps with a tool installer task', () => {
    const doc = yaml.load(generateCicdPipeline({ language: 'node', platform: 'azure-pipelines', steps: ['install', 'test', 'build'] })) as any;
    expect(doc.trigger).toBeDefined();
    expect(doc.pool.vmImage).toBe('ubuntu-latest');
    expect(doc.steps[0].task).toMatch(/^UseNode@/);
    expect(doc.steps.some((s: any) => s.script === 'npm test')).toBe(true);
  });

  it('circleci: uses a language image and a workflow', () => {
    const doc = yaml.load(generateCicdPipeline({ language: 'go', platform: 'circleci', steps: ['install', 'test', 'docker'] })) as any;
    expect(doc.version).toBe(2.1);
    expect(doc.jobs.build.docker[0].image).toMatch(/^cimg\/go:/);
    expect(doc.jobs.build.steps).toContain('setup_remote_docker');
    expect(doc.workflows).toBeDefined();
  });

  it('honours optional imageName / deployCommand / branch', () => {
    const out = generateCicdPipeline({ language: 'node', platform: 'github-actions', steps: ['docker', 'deploy'], imageName: 'myapp', deployCommand: './scripts/deploy.sh', branch: 'release' });
    expect(out).toContain('docker build -t myapp:');
    expect(out).toContain('./scripts/deploy.sh');
    expect(out).toContain('refs/heads/release');
  });
});
