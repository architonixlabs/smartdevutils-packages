/* ---
title: Show each step's status, as the run summary does
entry: index/stepStatus, index/runFinished, index/STEP_STATUS_LABEL
node: true
--- */
import { getRecipe, runRecipe, runSteps, resolveSteps, stepStatus, runFinished, STEP_STATUS_LABEL } from '@smartdevutils/recipes'

const ok = await runRecipe(getRecipe('decode-base64-json-param')!)
const broken = await runSteps(
  'Broken input',
  resolveSteps([{ toolId: 'base64-encoder-decoder', mode: 'decode' }, { toolId: 'json-formatter' }]),
  'bm90IGpzb24=', // Base64 of "not json"
)

for (const run of [ok, broken]) {
  console.log(`${run.name}: finished=${runFinished(run)}`)
  run.steps.forEach((step, i) => console.log(`  ${i + 1}. ${step.name}: ${STEP_STATUS_LABEL[stepStatus(run, i)]}`))
}
