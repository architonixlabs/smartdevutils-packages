export interface TokenEstimate {
  model: string;
  tokens: number;
  characters: number;
  words: number;
  costUsd: number;
  /** Always true: tokens come from a character heuristic, not the model's tokenizer. */
  isEstimate?: true;
  /** Date label of the pricing table (see MODEL_PRICING_AS_OF). */
  pricingAsOf?: string;
  /** Human-readable disclosure for the UI. */
  pricingNote?: string;
  /** false when the model is not in the pricing table and the $1 / 1M fallback was used. */
  pricingKnown?: boolean;
}

export interface PromptScores {
  clarity: number;
  scope: number;
  tone: number;
  constraints: number;
  format: number;
}

export interface PromptAnalysis {
  scores: PromptScores;
  overall: string;
  suggestions: string[];
}

const MODEL_PRICING: Record<string, { inputPer1M: number }> = {
  'gpt-4o': { inputPer1M: 5.0 },
  'gpt-4o-mini': { inputPer1M: 0.15 },
  'claude-sonnet': { inputPer1M: 3.0 },
  'claude-haiku': { inputPer1M: 0.25 },
  'gemini-pro': { inputPer1M: 3.5 },
  'gemini-flash': { inputPer1M: 0.075 },
};

/**
 * When the MODEL_PRICING values were last checked. They are approximate 2024 public list prices for
 * input tokens and have not been re-verified since; show this next to any cost figure.
 */
export const MODEL_PRICING_AS_OF = '2024';
export const MODEL_PRICING_NOTE =
  `Token count is an estimate (about 4 characters per token for Latin text, 1 per CJK/Kana/Hangul character), ` +
  `not the model's real tokenizer. Input prices are approximate list prices as of ${MODEL_PRICING_AS_OF} and may be out of date.`;

/** Han, Hiragana, Katakana (incl. half-width), Hangul, CJK punctuation and full-width forms. */
const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u{3000}-\u{303F}\u{30FC}\u{FF00}-\u{FFEF}]/gu;

function approximateTokens(text: string): number {
  const cjk = text.match(CJK_CHAR)?.length ?? 0;
  const words = text.replace(CJK_CHAR, ' ').split(/\s+/).filter(Boolean);
  return cjk + Math.ceil(words.reduce((acc, w) => acc + Math.ceil(w.length / 4) + 0.25, 0));
}

export function estimateTokensForModel(text: string, model: string): TokenEstimate {
  const tokens = approximateTokens(text);
  const known = Object.prototype.hasOwnProperty.call(MODEL_PRICING, model);
  const pricing = known ? MODEL_PRICING[model] : { inputPer1M: 1.0 };
  const costUsd = (tokens / 1_000_000) * pricing.inputPer1M;
  return {
    model,
    tokens,
    characters: text.length,
    words: text.trim() ? text.trim().split(/\s+/).length : 0,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
    isEstimate: true,
    pricingAsOf: MODEL_PRICING_AS_OF,
    pricingNote: known ? MODEL_PRICING_NOTE : `${MODEL_PRICING_NOTE} No price is known for "${model}"; a placeholder of $1 per 1M input tokens was used.`,
    pricingKnown: known,
  };
}

export function analyzeSystemPrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase();
  const suggestions: string[] = [];
  const scores: PromptScores = { clarity: 0, scope: 0, tone: 0, constraints: 0, format: 0 };

  if (/you are|your role|act as|you're/.test(lower)) { scores.clarity += 2; }
  if (prompt.length > 50) { scores.clarity += 1; }
  if (/task is|your job|help users/.test(lower)) { scores.clarity += 1; }
  if (scores.clarity === 0) { suggestions.push('Define a clear role or persona (e.g., "You are a...")'); }

  if (/do not|don't|avoid|only|must|never|always|limit/.test(lower)) { scores.scope += 2; }
  if (/specifically|focused on|only answer/.test(lower)) { scores.scope += 1; }
  if (prompt.length > 100) { scores.scope += 1; }
  if (scores.scope === 0) { suggestions.push('Clearly bound the task — what should the assistant NOT do?'); }

  if (/formal|casual|friendly|professional|concise|brief/.test(lower)) { scores.tone += 2; }
  if (/tone|style|manner/.test(lower)) { scores.tone += 1; }
  if (scores.tone === 0) { suggestions.push('Specify the desired tone (formal, friendly, concise, etc.)'); }

  if (/do not|never|refuse|cannot|must not/.test(lower)) { scores.constraints += 2; }
  if (/safety|harmful|illegal|inappropriate/.test(lower)) { scores.constraints += 1; }
  if (scores.constraints === 0) { suggestions.push('Add safety constraints or refusal instructions'); }

  if (/format|respond in|output as|list|markdown|json|bullet/.test(lower)) { scores.format += 2; }
  if (/example|template|structure/.test(lower)) { scores.format += 1; }
  if (scores.format === 0) { suggestions.push('Specify the output format (e.g., "Respond as a numbered list")'); }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const overall = total >= 15 ? 'A' : total >= 10 ? 'B' : total >= 6 ? 'C' : total >= 3 ? 'D' : 'F';

  return { scores, overall, suggestions };
}

export interface TrainingRow {
  input: string;
  output: string;
  /** Optional per-row system prompt (overrides options.systemPrompt). */
  system?: string;
}

export interface TrainingDataOptions {
  /** System prompt applied to every row that has no `system` of its own. */
  systemPrompt?: string;
}

export interface TrainingRowError {
  /** 1-based row number */
  row: number;
  field: 'row' | 'input' | 'output' | 'system';
  message: string;
}

export interface TrainingDataReport {
  /** JSONL for the valid rows only (one JSON object per line, trailing newline). */
  output: string;
  errors: TrainingRowError[];
  validRows: number;
}

function validateTrainingRow(row: unknown, n: number): TrainingRowError | null {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return { row: n, field: 'row', message: `Row ${n}: expected an object with "input" and "output".` };
  }
  const r = row as Record<string, unknown>;
  for (const field of ['input', 'output'] as const) {
    if (typeof r[field] !== 'string' || !(r[field] as string).trim()) {
      return { row: n, field, message: `Row ${n}: "${field}" must be a non-empty string.` };
    }
  }
  if (r['system'] !== undefined && typeof r['system'] !== 'string') {
    return { row: n, field: 'system', message: `Row ${n}: "system" must be a string when present.` };
  }
  return null;
}

/**
 * Converts rows to fine-tuning JSONL and reports invalid rows instead of emitting them.
 * - openai: {"messages":[{"role":"system",...}?, {"role":"user",...}, {"role":"assistant",...}]}
 * - anthropic (Amazon Bedrock Claude fine-tuning): {"system": "...", "messages":[user, assistant]};
 *   the system prompt is a top-level string, never a message. Without any system prompt the two
 *   formats are the same by specification.
 */
export function formatTrainingDataWithReport(
  data: TrainingRow[],
  format: 'openai' | 'anthropic',
  options: TrainingDataOptions = {},
): TrainingDataReport {
  const lines: string[] = [];
  const errors: TrainingRowError[] = [];
  data.forEach((row, i) => {
    const err = validateTrainingRow(row, i + 1);
    if (err) { errors.push(err); return; }
    const system = row.system ?? options.systemPrompt;
    const hasSystem = typeof system === 'string' && system.trim() !== '';
    const dialogue = [
      { role: 'user', content: row.input },
      { role: 'assistant', content: row.output },
    ];
    if (format === 'openai') {
      lines.push(JSON.stringify({ messages: hasSystem ? [{ role: 'system', content: system }, ...dialogue] : dialogue }));
    } else {
      lines.push(JSON.stringify(hasSystem ? { system, messages: dialogue } : { messages: dialogue }));
    }
  });
  return { output: lines.length ? lines.join('\n') + '\n' : '', errors, validRows: lines.length };
}

/**
 * Converts rows to fine-tuning JSONL (see formatTrainingDataWithReport for the formats).
 * Throws an Error listing every invalid row (missing / empty input or output).
 */
export function formatTrainingData(
  data: TrainingRow[],
  format: 'openai' | 'anthropic',
  options: TrainingDataOptions = {},
): string {
  const report = formatTrainingDataWithReport(data, format, options);
  if (report.errors.length) {
    const err = new Error(report.errors.map(e => e.message).join('\n')) as Error & { errors?: TrainingRowError[] };
    err.errors = report.errors;
    throw err;
  }
  return report.output;
}
