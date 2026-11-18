import type { ToolRunner } from './types'

/** One lazy loader per runnable tool id. Each runner is its own chunk (@smartdevutils/core/tools/<id>). */
export const RUNNER_LOADERS: Readonly<Record<string, () => Promise<{ runner: ToolRunner }>>> = {
  'base64-encoder-decoder': () => import('./runners/base64-encoder-decoder'),
  'boundary-value-analyzer': () => import('./runners/boundary-value-analyzer'),
  'cicd-pipeline-builder': () => import('./runners/cicd-pipeline-builder'),
  'ddl-diff': () => import('./runners/ddl-diff'),
  'docker-tag-checker': () => import('./runners/docker-tag-checker'),
  'gantt-generator': () => import('./runners/gantt-generator'),
  'hash-generator': () => import('./runners/hash-generator'),
  'index-advisor': () => import('./runners/index-advisor'),
  'json-formatter': () => import('./runners/json-formatter'),
  'k8s-yaml-validator': () => import('./runners/k8s-yaml-validator'),
  'log-parser': () => import('./runners/log-parser'),
  'migration-generator': () => import('./runners/migration-generator'),
  'performance-sla-checker': () => import('./runners/performance-sla-checker'),
  'slow-query-detector': () => import('./runners/slow-query-detector'),
  'sprint-velocity': () => import('./runners/sprint-velocity'),
  'sql-create-table': () => import('./runners/sql-create-table'),
  'system-prompt-analyzer': () => import('./runners/system-prompt-analyzer'),
  'training-data-formatter': () => import('./runners/training-data-formatter'),
  'url-encoder-decoder': () => import('./runners/url-encoder-decoder'),
  'uuid-generator': () => import('./runners/uuid-generator'),
}
