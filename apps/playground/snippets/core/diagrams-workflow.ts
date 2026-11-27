/* ---
title: Visualize a GitHub Actions workflow and find problems
entry: diagrams/visualizeWorkflow, diagrams/WORKFLOW_EXAMPLE_BROKEN
node: true
--- */
import { visualizeWorkflow, WORKFLOW_EXAMPLE_BROKEN } from '@smartdevutils/core/diagrams'

const result = visualizeWorkflow(WORKFLOW_EXAMPLE_BROKEN)
if (!result.ok) throw new Error(result.error)

for (const f of result.analysis!.findings) console.log(`[${f.severity}] ${f.message}`)
console.log('critical path:', result.analysis!.criticalPath.join(' -> '))
console.log(result.mermaid!.text)
