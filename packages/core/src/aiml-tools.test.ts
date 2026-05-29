import { describe, it, expect } from 'vitest';
import { estimateTokensForModel, analyzeSystemPrompt, formatTrainingData } from './aiml-tools';

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
