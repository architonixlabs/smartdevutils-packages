import { describe, it, expect } from 'vitest'
import { generateCicdPipeline } from '../../devops-tools'
import { runner } from './cicd-pipeline-builder'

describe('cicd-pipeline-builder runner', () => {
  it('uses the website defaults (node, github-actions, install + test)', () => {
    const r = runner.run('') as { output: string }
    expect(r.output).toBe(generateCicdPipeline({ language: 'node', platform: 'github-actions', steps: ['install', 'test'] }))
  })

  it('matches the website example "GitLab CI — Python"', () => {
    const steps = ['install', 'test', 'build', 'docker']
    const r = runner.run('', { options: { language: 'python', platform: 'gitlab-ci', steps } }) as { output: string }
    expect(r.output).toBe(generateCicdPipeline({ language: 'python', platform: 'gitlab-ci', steps: steps as never }))
  })

  it('accepts steps as a comma-separated string and the runner-only options', () => {
    const r = runner.run('', {
      options: { language: 'go', steps: 'install, test, docker, deploy', imageName: 'demo-app', branch: 'release' },
    }) as { output: string }
    expect(r.output).toBe(
      generateCicdPipeline({
        language: 'go',
        platform: 'github-actions',
        steps: ['install', 'test', 'docker', 'deploy'],
        imageName: 'demo-app',
        branch: 'release',
      }),
    )
    expect(r.output).toContain('demo-app')
  })

  it('rejects unknown steps', () => {
    const r = runner.run('', { options: { steps: ['install', 'publish'] } }) as { output: string; error?: string }
    expect(r.output).toBe('')
    expect(r.error).toMatch(/^Unknown step\(s\): publish/)
  })
})
