/* ---
title: Parse, analyse and draw a workflow step by step
entry: diagrams/parseWorkflow, diagrams/analyzeWorkflow, diagrams/workflowToMermaid, diagrams/jobLines, diagrams/matrixText, diagrams/matrixInfo
description: The pieces visualizeWorkflow() runs in one call, for when you need the parsed jobs or the findings yourself.
node: true
--- */
import { parseWorkflow, analyzeWorkflow, workflowToMermaid, jobLines, matrixText, WORKFLOW_EXAMPLE_CI } from '@smartdevutils/core/diagrams'

const parsed = parseWorkflow(WORKFLOW_EXAMPLE_CI)
if (!parsed.ok) throw new Error(parsed.error)
const wf = parsed.workflow

console.log('triggers:', wf.triggers.map((t) => t.event).join(', '))
for (const job of wf.jobs) {
  console.log(`- ${jobLines(job).join(' | ')}${job.matrix ? `  [${matrixText(job.matrix)}]` : ''}`)
}

const analysis = analyzeWorkflow(wf)
console.log('stages:', analysis.stages.map((s) => s.join(' + ')).join(' -> '))
console.log('findings:', analysis.findings.length ? analysis.findings.map((f) => f.message) : 'none')

const { text, drawnJobs } = workflowToMermaid(wf, analysis, { showSteps: false })
console.log(`${drawnJobs} jobs drawn`)
console.log(text)
