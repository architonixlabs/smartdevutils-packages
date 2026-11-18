// Specs of every tool that has a runner. Pure data: importing this loads no tool logic.
import type { ToolSpec } from '../types'
import { spec as s0 } from './base64-encoder-decoder'
import { spec as s1 } from './boundary-value-analyzer'
import { spec as s2 } from './cicd-pipeline-builder'
import { spec as s3 } from './ddl-diff'
import { spec as s4 } from './docker-tag-checker'
import { spec as s5 } from './gantt-generator'
import { spec as s6 } from './hash-generator'
import { spec as s7 } from './index-advisor'
import { spec as s8 } from './json-formatter'
import { spec as s9 } from './k8s-yaml-validator'
import { spec as s10 } from './log-parser'
import { spec as s11 } from './migration-generator'
import { spec as s12 } from './performance-sla-checker'
import { spec as s13 } from './slow-query-detector'
import { spec as s14 } from './sprint-velocity'
import { spec as s15 } from './sql-create-table'
import { spec as s16 } from './system-prompt-analyzer'
import { spec as s17 } from './training-data-formatter'
import { spec as s18 } from './url-encoder-decoder'
import { spec as s19 } from './uuid-generator'

export const TOOL_SPECS: readonly ToolSpec[] = [
  s0,
  s1,
  s2,
  s3,
  s4,
  s5,
  s6,
  s7,
  s8,
  s9,
  s10,
  s11,
  s12,
  s13,
  s14,
  s15,
  s16,
  s17,
  s18,
  s19,
]
