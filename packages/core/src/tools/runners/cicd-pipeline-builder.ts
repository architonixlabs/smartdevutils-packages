// Mirrors the website's CicdPipelineBuilderComponent.generate(). It builds from options only.
import { generateCicdPipeline, type CicdConfig } from '../../devops-tools'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/cicd-pipeline-builder'

type Step = CicdConfig['steps'][number]
const STEPS: readonly Step[] = ['install', 'test', 'lint', 'build', 'docker', 'deploy']

export const runner = defineRunner(spec, (_input, { options }) => {
  const language = opt.oneOf<CicdConfig['language']>(
    options.language,
    ['node', 'python', 'go', 'java', 'dotnet', 'rust'],
    'node',
  )
  const platform = opt.oneOf<CicdConfig['platform']>(
    options.platform,
    ['github-actions', 'gitlab-ci', 'circleci', 'azure-pipelines'],
    'github-actions',
  )
  const raw = typeof options.steps === 'string' ? options.steps.split(',') : options.steps
  if (!Array.isArray(raw)) return { output: '', error: 'steps must be an array of step names.' }
  const steps = raw.map((s) => String(s).trim()).filter(Boolean)
  const unknown = steps.filter((s) => !(STEPS as readonly string[]).includes(s))
  if (unknown.length) {
    return { output: '', error: `Unknown step(s): ${unknown.join(', ')}. Steps: ${STEPS.join(', ')}.` }
  }
  const config: CicdConfig = { language, platform, steps: steps as Step[] }
  const imageName = opt.str(options.imageName).trim()
  const deployCommand = opt.str(options.deployCommand).trim()
  const branch = opt.str(options.branch).trim()
  if (imageName) config.imageName = imageName
  if (deployCommand) config.deployCommand = deployCommand
  if (branch) config.branch = branch
  return { output: generateCicdPipeline(config) }
})

export default runner
