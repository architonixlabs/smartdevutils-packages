/* ---
title: A flowchart from nodes and edges
entry: diagrams/renderFlowchart
node: true
--- */
import { renderFlowchart } from '@smartdevutils/core/diagrams'

const { text, nodes, edges } = renderFlowchart({
  direction: 'LR',
  groups: [{ id: 'ci', label: 'CI' }],
  nodes: [
    { id: 'push', lines: ['git push'], shape: 'round' },
    { id: 'test', lines: ['Test', 'node 20 + 22'], group: 'ci' },
    { id: 'build', lines: ['Build image'], group: 'ci' },
    { id: 'deploy', lines: ['Deploy'] },
  ],
  edges: [
    { from: 'push', to: 'test' },
    { from: 'test', to: 'build' },
    { from: 'build', to: 'deploy', label: 'main only' },
  ],
})
console.log(`${nodes} nodes, ${edges} edges`)
console.log(text)
