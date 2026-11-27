/* ---
title: A Gantt chart as Mermaid text
entry: planning/generateGanttMermaid
description: Paste the output into any Markdown that renders Mermaid, or into <sdu-diagram>.
node: true
--- */
import { generateGanttMermaid } from '@smartdevutils/core/planning'

const mermaid = generateGanttMermaid([
  { title: 'Discovery', start: '2026-03-02', end: '2026-03-13', section: 'Plan' },
  { title: 'Wireframes', start: '2026-03-16', end: '2026-03-27', section: 'Design' },
  { title: 'Frontend build', start: '2026-04-13', end: '2026-05-08', section: 'Build' },
  { title: 'Launch', start: '2026-05-18', end: '2026-05-22', section: 'Release' },
])
console.log(mermaid)
