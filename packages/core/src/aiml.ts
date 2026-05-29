export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function cleanPrompt(text: string): string {
  return text.replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function jsonToTrainingJsonl(json: string): string {
  const rows = JSON.parse(json);
  if (!Array.isArray(rows)) throw new Error('Input must be a JSON array');
  return rows.map(row => JSON.stringify(row)).join('\n') + '\n';
}
