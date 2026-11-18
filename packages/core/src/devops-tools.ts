import { dumpYaml } from './yaml';

export interface CicdConfig {
  language: 'node' | 'python' | 'go' | 'java' | 'dotnet' | 'rust';
  platform: 'github-actions' | 'gitlab-ci' | 'circleci' | 'azure-pipelines';
  steps: ('install' | 'test' | 'lint' | 'build' | 'docker' | 'deploy')[];
  /** Image name for the docker step (default "app"). */
  imageName?: string;
  /** Command run by the deploy step (default: an echo placeholder). */
  deployCommand?: string;
  /** Branch that triggers CI and gates deploy (default "main"). */
  branch?: string;
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

type CicdLanguage = CicdConfig['language'];
type CicdStep = CicdConfig['steps'][number];

const INSTALL_CMDS: Record<CicdLanguage, string> = {
  node: 'npm install', python: 'pip install -r requirements.txt',
  go: 'go mod download', java: 'mvn -B install -DskipTests',
  dotnet: 'dotnet restore', rust: 'cargo fetch',
};
const LINT_CMDS: Record<CicdLanguage, string> = {
  node: 'npm run lint', python: 'pip install ruff && ruff check .',
  go: 'go vet ./...', java: 'mvn -B checkstyle:check',
  dotnet: 'dotnet format --verify-no-changes',
  rust: 'rustup component add clippy rustfmt && cargo fmt --check && cargo clippy -- -D warnings',
};
const TEST_CMDS: Record<CicdLanguage, string> = {
  node: 'npm test', python: 'pytest', go: 'go test ./...',
  java: 'mvn -B test', dotnet: 'dotnet test', rust: 'cargo test',
};
const BUILD_CMDS: Record<CicdLanguage, string> = {
  node: 'npm run build', python: 'pip install build && python -m build', go: 'go build ./...',
  java: 'mvn -B package', dotnet: 'dotnet build --configuration Release', rust: 'cargo build --release',
};
const BUILD_STEP_DEFS: Record<'install' | 'lint' | 'test' | 'build', [string, Record<CicdLanguage, string>]> = {
  install: ['Install dependencies', INSTALL_CMDS],
  lint: ['Lint', LINT_CMDS],
  test: ['Test', TEST_CMDS],
  build: ['Build', BUILD_CMDS],
};

const GITHUB_SETUP: Record<CicdLanguage, Record<string, unknown>> = {
  node: { name: 'Set up Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
  python: { name: 'Set up Python', uses: 'actions/setup-python@v5', with: { 'python-version': '3.12' } },
  go: { name: 'Set up Go', uses: 'actions/setup-go@v5', with: { 'go-version': 'stable' } },
  java: { name: 'Set up JDK', uses: 'actions/setup-java@v4', with: { distribution: 'temurin', 'java-version': '21' } },
  dotnet: { name: 'Set up .NET', uses: 'actions/setup-dotnet@v4', with: { 'dotnet-version': '8.0.x' } },
  rust: { name: 'Set up Rust', uses: 'dtolnay/rust-toolchain@stable' },
};
const GITLAB_IMAGES: Record<CicdLanguage, string> = {
  node: 'node:20', python: 'python:3.12', go: 'golang:1.22', java: 'maven:3.9-eclipse-temurin-21',
  dotnet: 'mcr.microsoft.com/dotnet/sdk:8.0', rust: 'rust:1',
};
const CIRCLE_IMAGES: Record<CicdLanguage, string> = {
  node: 'cimg/node:20.11', python: 'cimg/python:3.12', go: 'cimg/go:1.22', java: 'cimg/openjdk:21.0',
  dotnet: 'mcr.microsoft.com/dotnet/sdk:8.0', rust: 'cimg/rust:1.77',
};
const AZURE_SETUP: Record<CicdLanguage, Record<string, unknown>> = {
  node: { task: 'UseNode@1', inputs: { version: '20.x' }, displayName: 'Set up Node.js' },
  python: { task: 'UsePythonVersion@0', inputs: { versionSpec: '3.12' }, displayName: 'Set up Python' },
  go: { task: 'GoTool@0', inputs: { version: '1.22.5' }, displayName: 'Set up Go' },
  java: { task: 'JavaToolInstaller@0', inputs: { versionSpec: '21', jdkArchitectureOption: 'x64', jdkSourceOption: 'PreInstalled' }, displayName: 'Set up JDK' },
  dotnet: { task: 'UseDotNet@2', inputs: { packageType: 'sdk', version: '8.0.x' }, displayName: 'Set up .NET' },
  rust: { script: 'rustup default stable', displayName: 'Set up Rust' },
};

const DEFAULT_DEPLOY_CMD = 'echo "Placeholder: replace with your deploy command (CicdConfig.deployCommand)"';

/**
 * Generates a CI pipeline as YAML (serialised with js-yaml, so the output always parses).
 * install/lint/test/build run in canonical order in one build job; docker builds an image tagged
 * with the commit SHA; deploy runs as a separate job/step gated on `branch` (default "main").
 */
export function generateCicdPipeline(config: CicdConfig): string {
  const lang = config.language;
  const branch = config.branch ?? 'main';
  const image = config.imageName ?? 'app';
  const deployCmd = config.deployCommand ?? DEFAULT_DEPLOY_CMD;
  const wanted = new Set<CicdStep>(config.steps);
  const buildSteps = (['install', 'lint', 'test', 'build'] as const)
    .filter(s => wanted.has(s))
    .map(s => ({ name: BUILD_STEP_DEFS[s][0], cmd: BUILD_STEP_DEFS[s][1][lang] }));
  const docker = wanted.has('docker');
  const deploy = wanted.has('deploy');
  const dump = (doc: unknown) => dumpYaml(doc, { lineWidth: -1, noRefs: true });

  if (config.platform === 'github-actions') {
    const steps: Record<string, unknown>[] = [
      { uses: 'actions/checkout@v4' },
      GITHUB_SETUP[lang],
      ...buildSteps.map(s => ({ name: s.name, run: s.cmd })),
    ];
    if (docker) steps.push({ name: 'Build Docker image', run: `docker build -t ${image}:\${{ github.sha }} .` });
    const jobs: Record<string, unknown> = { build: { 'runs-on': 'ubuntu-latest', steps } };
    if (deploy) {
      jobs['deploy'] = {
        needs: 'build',
        if: `github.event_name == 'push' && github.ref == 'refs/heads/${branch}'`,
        'runs-on': 'ubuntu-latest',
        steps: [{ uses: 'actions/checkout@v4' }, { name: 'Deploy', run: deployCmd }],
      };
    }
    return dump({ name: 'CI', on: { push: { branches: [branch] }, pull_request: { branches: [branch] } }, jobs });
  }

  if (config.platform === 'gitlab-ci') {
    const jobs: Record<string, unknown> = {};
    const stages: string[] = [];
    if (buildSteps.length) {
      stages.push('build');
      jobs['build'] = { stage: 'build', image: GITLAB_IMAGES[lang], script: buildSteps.map(s => s.cmd) };
    }
    if (docker) {
      stages.push('docker');
      jobs['docker'] = {
        stage: 'docker', image: 'docker:27', services: ['docker:27-dind'],
        variables: { DOCKER_TLS_CERTDIR: '/certs' },
        script: [`docker build -t ${image}:$CI_COMMIT_SHORT_SHA .`],
      };
    }
    if (deploy) {
      stages.push('deploy');
      const rule = config.branch ? `$CI_COMMIT_BRANCH == "${branch}"` : '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH';
      jobs['deploy'] = { stage: 'deploy', image: GITLAB_IMAGES[lang], script: [deployCmd], rules: [{ if: rule }] };
    }
    return dump({ stages, ...jobs });
  }

  if (config.platform === 'circleci') {
    const steps: unknown[] = ['checkout', ...buildSteps.map(s => ({ run: { name: s.name, command: s.cmd } }))];
    if (docker) {
      steps.push('setup_remote_docker');
      steps.push({ run: { name: 'Build Docker image', command: `docker build -t ${image}:$CIRCLE_SHA1 .` } });
    }
    const jobs: Record<string, unknown> = { build: { docker: [{ image: CIRCLE_IMAGES[lang] }], steps } };
    const workflowJobs: unknown[] = ['build'];
    if (deploy) {
      jobs['deploy'] = { docker: [{ image: CIRCLE_IMAGES[lang] }], steps: ['checkout', { run: { name: 'Deploy', command: deployCmd } }] };
      workflowJobs.push({ deploy: { requires: ['build'], filters: { branches: { only: branch } } } });
    }
    return dump({ version: 2.1, jobs, workflows: { ci: { jobs: workflowJobs } } });
  }

  // azure-pipelines
  const steps: Record<string, unknown>[] = [AZURE_SETUP[lang], ...buildSteps.map(s => ({ script: s.cmd, displayName: s.name }))];
  if (docker) steps.push({ script: `docker build -t ${image}:$(Build.SourceVersion) .`, displayName: 'Build Docker image' });
  if (deploy) {
    steps.push({
      script: deployCmd, displayName: 'Deploy',
      condition: `and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/${branch}'))`,
    });
  }
  return dump({ trigger: [branch], pr: [branch], pool: { vmImage: 'ubuntu-latest' }, steps });
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
