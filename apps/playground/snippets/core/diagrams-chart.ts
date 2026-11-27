/* ---
title: A chart from a CSV table
entry: diagrams/buildChart, diagrams/parseTable, diagrams/suggestChart, diagrams/profileColumns, diagrams/statusLine
description: parseTable reads CSV, TSV, Markdown or JSON tables; suggestChart picks a chart type; buildChart writes Mermaid.
node: true
--- */
import { parseTable, profileColumns, suggestChart, defaultMapping, buildChart, statusLine } from '@smartdevutils/core/diagrams'

const csv = `month,signups,churned
Jan,120,14
Feb,150,18
Mar,210,22
Apr,260,19`

const table = parseTable(csv)
if ('error' in table) throw new Error(table.error)

const profiles = profileColumns(table)
const suggestion = suggestChart(table, profiles)
const type = suggestion?.type ?? 'bar'
console.log('suggested:', type, '-', suggestion?.reason ?? 'no suggestion, using a bar chart')

const chart = buildChart(type, table, defaultMapping(profiles), { title: 'Signups per month' })
console.log(statusLine(table, chart))
console.log(chart.error ?? chart.mermaid)

// Or choose the type yourself:
console.log(buildChart('pie', table, defaultMapping(profiles), { title: 'Signups' }).mermaid)
