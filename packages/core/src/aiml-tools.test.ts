import { describe, it, expect } from 'vitest';
import { estimateTokensForModel, analyzeSystemPrompt, formatTrainingData, formatTrainingDataWithReport, MODEL_PRICING_AS_OF } from './aiml-tools';

describe('estimateTokensForModel', () => {
  it('returns token count for gpt-4o', () => {
    const result = estimateTokensForModel('hello world', 'gpt-4o');
    expect(result.tokens).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThanOrEqual(0);
    expect(result.model).toBe('gpt-4o');
  });

  it('returns counts for all supported models', () => {
    const models = ['gpt-4o', 'claude-sonnet', 'gemini-pro'];
    for (const model of models) {
      const r = estimateTokensForModel('test text', model);
      expect(r.tokens).toBeGreaterThan(0);
    }
  });
});

describe('analyzeSystemPrompt', () => {
  it('scores a well-formed prompt highly', () => {
    const prompt = 'You are a helpful assistant. Your task is to answer user questions about TypeScript. Always respond in English. Do not discuss topics outside software development. Format your responses as numbered lists.';
    const result = analyzeSystemPrompt(prompt);
    expect(result.scores.clarity).toBeGreaterThan(0);
    expect(result.overall).toBeTruthy();
  });

  it('returns low scope score for vague prompt', () => {
    const result = analyzeSystemPrompt('Be helpful.');
    expect(result.scores.scope).toBeLessThanOrEqual(2);
  });

  it('always returns all 5 dimension scores', () => {
    const result = analyzeSystemPrompt('any text');
    expect(result.scores).toHaveProperty('clarity');
    expect(result.scores).toHaveProperty('scope');
    expect(result.scores).toHaveProperty('tone');
    expect(result.scores).toHaveProperty('constraints');
    expect(result.scores).toHaveProperty('format');
  });
});

describe('formatTrainingData', () => {
  it('converts to openai jsonl format', () => {
    const data = [{ input: 'hello', output: 'world' }];
    const result = formatTrainingData(data, 'openai');
    const line = JSON.parse(result.split('\n')[0]);
    expect(line.messages).toBeDefined();
    expect(line.messages.some((m: { role: string }) => m.role === 'user')).toBe(true);
    expect(line.messages.some((m: { role: string }) => m.role === 'assistant')).toBe(true);
  });

  it('converts to anthropic format', () => {
    const data = [{ input: 'hi', output: 'hello' }];
    const result = formatTrainingData(data, 'anthropic');
    const line = JSON.parse(result.split('\n')[0]);
    expect(line.messages).toBeDefined();
  });
});

describe('formatTrainingData (1.2.0 fixes)', () => {
  const rows = [{ input: 'hi', output: 'hello', system: 'You are terse.' }];

  it('openai puts the system prompt in messages', () => {
    const line = JSON.parse(formatTrainingData(rows, 'openai').trim());
    expect(line).toEqual({ messages: [
      { role: 'system', content: 'You are terse.' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ] });
  });

  it('anthropic puts the system prompt top-level and only user/assistant in messages', () => {
    const line = JSON.parse(formatTrainingData(rows, 'anthropic').trim());
    expect(line).toEqual({ system: 'You are terse.', messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ] });
  });

  it('openai and anthropic outputs differ when a system prompt is given', () => {
    const data = [{ input: 'a', output: 'b' }];
    expect(formatTrainingData(data, 'openai', { systemPrompt: 'S' })).not.toBe(formatTrainingData(data, 'anthropic', { systemPrompt: 'S' }));
  });

  it('a per-row system overrides options.systemPrompt', () => {
    const line = JSON.parse(formatTrainingData(rows, 'anthropic', { systemPrompt: 'default' }).trim());
    expect(line.system).toBe('You are terse.');
  });

  it('reports per-row errors for missing content', () => {
    const bad = [{ input: 'ok', output: 'ok' }, { input: '', output: 'x' }, { input: 'y' } as any];
    const report = formatTrainingDataWithReport(bad, 'openai');
    expect(report.errors).toEqual([
      { row: 2, field: 'input', message: 'Row 2: "input" must be a non-empty string.' },
      { row: 3, field: 'output', message: 'Row 3: "output" must be a non-empty string.' },
    ]);
    expect(report.output.trim().split('\n')).toHaveLength(1);
    expect(() => formatTrainingData(bad, 'openai')).toThrow(/Row 2/);
  });
});

describe('estimateTokensForModel (1.2.0 fixes)', () => {
  it('counts CJK / Kana / Hangul at ~1 token per character', () => {
    expect(estimateTokensForModel('日本語テキスト', 'gpt-4o').tokens).toBe(7);
    expect(estimateTokensForModel('한국어', 'gpt-4o').tokens).toBe(3);
    expect(estimateTokensForModel('你好，世界', 'gpt-4o').tokens).toBe(5);
  });

  it('keeps the ~4 chars/token heuristic for Latin text', () => {
    expect(estimateTokensForModel('hello world', 'gpt-4o').tokens).toBe(5);
    expect(estimateTokensForModel('hello 世界', 'gpt-4o').tokens).toBe(5);
  });

  it('returns 0 tokens for empty text', () => {
    expect(estimateTokensForModel('', 'gpt-4o').tokens).toBe(0);
    expect(estimateTokensForModel('   ', 'gpt-4o').words).toBe(0);
  });

  it('labels the result as an estimate and discloses pricing staleness', () => {
    const r = estimateTokensForModel('hello', 'gpt-4o');
    expect(r.isEstimate).toBe(true);
    expect(r.pricingAsOf).toBe(MODEL_PRICING_AS_OF);
    expect(r.pricingNote).toMatch(/estimate/i);
    expect(r.pricingKnown).toBe(true);
    expect(estimateTokensForModel('hello', 'unknown-model').pricingKnown).toBe(false);
  });

  it('does not change existing prices', () => {
    expect(estimateTokensForModel('x'.repeat(4000), 'gpt-4o').costUsd).toBeCloseTo((1001 / 1e6) * 5.0, 9);
  });
});
