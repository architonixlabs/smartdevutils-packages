import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'cicd-pipeline-builder',
  slug: 'cicd-pipeline-builder',
  name: 'CI/CD Pipeline Builder',
  category: 'devops-tools',
  toolType: 'generator',
  modes: [],
  input: { kind: 'none' },
  options: [
    {
      key: 'language',
      label: 'Language',
      type: 'select',
      default: 'node',
      choices: [
        { value: 'node', label: 'Node.js' },
        { value: 'python', label: 'Python' },
        { value: 'go', label: 'Go' },
        { value: 'java', label: 'Java' },
        { value: 'dotnet', label: '.NET' },
        { value: 'rust', label: 'Rust' },
      ],
    },
    {
      key: 'platform',
      label: 'Platform',
      type: 'select',
      default: 'github-actions',
      choices: [
        { value: 'github-actions', label: 'GitHub Actions' },
        { value: 'gitlab-ci', label: 'GitLab CI' },
        { value: 'circleci', label: 'CircleCI' },
        { value: 'azure-pipelines', label: 'Azure Pipelines (not on the website yet)' },
      ],
    },
    {
      key: 'steps',
      label: 'Steps',
      type: 'json',
      default: ['install', 'test'],
      description: 'Any of install, test, lint, build, docker, deploy (an array, or a comma-separated string).',
    },
    { key: 'imageName', label: 'Docker image name (runner-only)', type: 'text', default: undefined },
    { key: 'deployCommand', label: 'Deploy command (runner-only)', type: 'text', default: undefined },
    { key: 'branch', label: 'Branch (runner-only)', type: 'text', default: undefined },
  ],
  output: 'text',
}
