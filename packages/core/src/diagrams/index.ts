// Pure Mermaid (and DBML) text builders. None of them import mermaid: they return diagram source text,
// which any Mermaid renderer can draw. Ported from the SmartDevUtils website so both produce the same output.

export * from './flowchart';
export * from './ddl-to-erd';
export * from './ddl-change-diagram';
export * from './compose-diagram';
export * from './k8s-resource-map';
export * from './markdown-mermaid';
export * from './mermaid-editor';
export { parseCell, parseDelimited, MISSING_TOKENS } from './number-parse';

// Chart maker: generic names (DEFAULT_OPTIONS, CAPS, …) get a chart prefix here.
export {
  CHART_TYPES, INPUT_FORMATS, FORMAT_NAMES, CHART_LOCALES, MAX_SERIES, MAX_LABEL,
  parseNumber, formatNumber, niceCeil, quoteLabel, rawText, toAscii, csvField, detectFormat, parseTable,
  isDateLike, profileColumns, suggestChart, defaultMapping, quadrantScale, buildChart, statusLine,
  CAPS as CHART_CAPS,
  DEFAULT_OPTIONS as CHART_DEFAULT_OPTIONS,
} from './chart-maker';
export type {
  NumberLocale, ChartType, InputFormat, DetectedFormat, HeaderMode, SortOrder, ChartTable, ColumnProfile,
  ChartMapping, ChartOptions, ChartResult, ChartSuggestion,
} from './chart-maker';

// GitHub Actions visualizer: generic names get a workflow prefix here.
export {
  MATRIX_JOB_LIMIT, LONG_CHAIN, parseWorkflow, matrixInfo, matrixText, analyzeWorkflow, jobLines,
  MAX_INPUT_CHARS as WORKFLOW_MAX_INPUT_CHARS,
  MAX_DRAWN_JOBS as WORKFLOW_MAX_DRAWN_JOBS,
  MAX_STEPS_PER_JOB as WORKFLOW_MAX_STEPS_PER_JOB,
  MAX_STEP_NODES as WORKFLOW_MAX_STEP_NODES,
  escapeLabel as workflowEscapeLabel,
  buildMermaid as workflowToMermaid,
  visualize as visualizeWorkflow,
  EXAMPLE_CI as WORKFLOW_EXAMPLE_CI,
  EXAMPLE_REUSABLE as WORKFLOW_EXAMPLE_REUSABLE,
  EXAMPLE_BROKEN as WORKFLOW_EXAMPLE_BROKEN,
} from './github-actions';
export type {
  Severity as WorkflowSeverity,
  Finding as WorkflowFinding,
  Trigger as WorkflowTrigger,
  MatrixInfo, Step as WorkflowStep, Job as WorkflowJob, Workflow, Analysis as WorkflowAnalysis,
  ParseResult as WorkflowParseResult,
  MermaidOptions as WorkflowMermaidOptions,
  MermaidResult as WorkflowMermaidResult,
  VisualizeResult as WorkflowVisualizeResult,
} from './github-actions';

// Gantt chart builder (already in core's planning module).
export { generateGanttMermaid } from '../planning';
