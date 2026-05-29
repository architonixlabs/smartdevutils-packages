export interface TokenEstimate {
  model: string;
  tokens: number;
  characters: number;
  words: number;
  costUsd: number;
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

function approximateTokens(text: string): number {
  const words = text.trim().split(/\s+/);
  return Math.ceil(words.reduce((acc, w) => acc + Math.ceil(w.length / 4) + 0.25, 0));
}

export function estimateTokensForModel(text: string, model: string): TokenEstimate {
  const tokens = approximateTokens(text);
  const pricing = MODEL_PRICING[model] ?? { inputPer1M: 1.0 };
  const costUsd = (tokens / 1_000_000) * pricing.inputPer1M;
  return {
    model,
    tokens,
    characters: text.length,
    words: text.trim().split(/\s+/).length,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
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

export function formatTrainingData(
  data: { input: string; output: string }[],
  format: 'openai' | 'anthropic'
): string {
  return data.map(row => {
    if (format === 'openai') {
      return JSON.stringify({
        messages: [
          { role: 'user', content: row.input },
          { role: 'assistant', content: row.output },
        ],
      });
    } else {
      return JSON.stringify({
        messages: [
          { role: 'user', content: row.input },
          { role: 'assistant', content: row.output },
        ],
      });
    }
  }).join('\n') + '\n';
}
