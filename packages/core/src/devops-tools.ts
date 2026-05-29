export interface CicdConfig {
  language: 'node' | 'python' | 'go' | 'java' | 'dotnet' | 'rust';
  platform: 'github-actions' | 'gitlab-ci' | 'circleci' | 'azure-pipelines';
  steps: ('install' | 'test' | 'lint' | 'build' | 'docker' | 'deploy')[];
}

export interface DockerImageResult {
  image: string;
  status: 'pinned' | 'versioned' | 'unpinned';
  suggestion: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  raw: string;
}

export interface K8sValidationResult {
  errors: string[];
  warnings: string[];
}

const INSTALL_CMDS: Record<string, string> = {
  node: 'npm install', python: 'pip install -r requirements.txt',
  go: 'go mod download', java: 'mvn install -DskipTests',
  dotnet: 'dotnet restore', rust: 'cargo build',
};
const TEST_CMDS: Record<string, string> = {
  node: 'npm test', python: 'pytest', go: 'go test ./...',
  java: 'mvn test', dotnet: 'dotnet test', rust: 'cargo test',
};
const BUILD_CMDS: Record<string, string> = {
  node: 'npm run build', python: 'python -m build', go: 'go build ./...',
  java: 'mvn package', dotnet: 'dotnet build --configuration Release', rust: 'cargo build --release',
};

export function generateCicdPipeline(config: CicdConfig): string {
  const stepCmds = config.steps.map(s => {
    if (s === 'install') return INSTALL_CMDS[config.language] ?? '';
    if (s === 'test') return TEST_CMDS[config.language] ?? '';
    if (s === 'build') return BUILD_CMDS[config.language] ?? '';
    return s;
  }).filter(Boolean);

  if (config.platform === 'github-actions') {
    return `name: CI\non:\n  push:\n    branches: [main]\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n${stepCmds.map(c => `      - run: ${c}`).join('\n')}`;
  }
  if (config.platform === 'gitlab-ci') {
    return `stages:\n  - build\nbuild:\n  stage: build\n  script:\n${stepCmds.map(c => `    - ${c}`).join('\n')}`;
  }
  if (config.platform === 'circleci') {
    return `version: 2.1\njobs:\n  build:\n    docker:\n      - image: cimg/base:stable\n    steps:\n      - checkout\n${stepCmds.map(c => `      - run: ${c}`).join('\n')}`;
  }
  return stepCmds.join('\n');
}

export function detectUnpinnedDockerImages(text: string): DockerImageResult[] {
  const lines = text.split('\n');
  const results: DockerImageResult[] = [];
  for (const line of lines) {
    const fromMatch = line.match(/^\s*FROM\s+(\S+)/i);
    const imageMatch = line.match(/^\s*image:\s*(\S+)/i);
    const image = fromMatch?.[1] ?? imageMatch?.[1];
    if (!image || image === 'scratch') { continue; }
    let status: 'pinned' | 'versioned' | 'unpinned';
    let suggestion: string;
    if (image.includes('@sha256:')) {
      status = 'pinned'; suggestion = 'Good — image is pinned with a digest.';
    } else if (image.endsWith(':latest') || !image.includes(':')) {
      status = 'unpinned'; suggestion = `Pin the image: ${image.split(':')[0]}:VERSION@sha256:DIGEST`;
    } else {
      status = 'versioned'; suggestion = 'Consider pinning with a SHA digest for full reproducibility.';
    }
    results.push({ image, status, suggestion });
  }
  return results;
}

export function parseLogLines(text: string): LogEntry[] {
  return text.split('\n').filter(l => l.trim()).map(raw => {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      return {
        timestamp: String(obj['timestamp'] ?? obj['time'] ?? obj['ts'] ?? ''),
        level: String(obj['level'] ?? obj['severity'] ?? obj['lvl'] ?? '').toUpperCase(),
        source: String(obj['source'] ?? obj['logger'] ?? obj['service'] ?? ''),
        message: String(obj['message'] ?? obj['msg'] ?? ''),
        raw,
      };
    } catch {
      const syslog = raw.match(/^(\w{3}\s+\d+\s+\S+)\s+(\S+)\s+(\S+):\s+(.*)/);
      if (syslog) {
        return { timestamp: syslog[1], level: '', source: syslog[3], message: syslog[4], raw };
      }
      return { timestamp: '', level: '', source: '', message: raw, raw };
    }
  });
}

export function validateK8sManifest(yamlText: string): K8sValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = yamlText;

  if (!text.includes('apiVersion:')) { errors.push('Missing required field: apiVersion'); }
  if (!text.includes('kind:')) { errors.push('Missing required field: kind'); }
  if (!text.match(/metadata:\s*\n\s+name:/)) { warnings.push('metadata.name not found'); }
  if (text.includes(':latest')) { warnings.push('Image uses :latest tag — pin to a specific version for reproducibility'); }
  if (!text.includes('resources:')) { warnings.push('No resource limits defined — add resources.limits to prevent runaway containers'); }
  if (!text.includes('readinessProbe:') && !text.includes('livenessProbe:')) {
    warnings.push('No readinessProbe or livenessProbe defined');
  }
  if (!text.includes('securityContext:')) { warnings.push('No securityContext defined'); }
  const replicasMatch = text.match(/replicas:\s*(\d+)/);
  if (replicasMatch && parseInt(replicasMatch[1], 10) < 1) { errors.push('replicas must be >= 1'); }

  return { errors, warnings };
}
