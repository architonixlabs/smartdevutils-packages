/* ---
title: Generate a CI pipeline
entry: devops-tools/generateCicdPipeline
node: true
--- */
import { generateCicdPipeline } from '@smartdevutils/core/devops-tools'

const yaml = generateCicdPipeline({
  language: 'node',
  platform: 'github-actions',
  steps: ['install', 'lint', 'test', 'build', 'docker'],
  imageName: 'acme/web',
  branch: 'main',
})
console.log(yaml)
