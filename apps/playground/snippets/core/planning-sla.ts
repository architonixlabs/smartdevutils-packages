/* ---
title: Latency percentiles against an SLA
entry: planning/computePercentiles, planning/computeVelocityStats
node: true
--- */
import { computePercentiles, computeVelocityStats } from '@smartdevutils/core/planning'

const responseTimesMs = [82, 95, 101, 110, 118, 124, 131, 140, 146, 152, 160, 171, 180, 188, 195, 210, 232, 265, 310, 920]
const sla = computePercentiles(responseTimesMs, { p50: 200, p95: 500, p99: 800 })
console.log(sla.actual, sla.withinSla, `${sla.breachedCount} target(s) breached`)

console.log(computeVelocityStats([21, 24, 19, 26, 23, 25]))
