export type KeywordIntent = 'informational' | 'comparison' | 'commercial' | 'transactional';

export function estimateIntent(keyword: string): KeywordIntent {
  const text = keyword.toLowerCase();
  if (/\b(vs|versus|alternative|compare)\b/.test(text)) return 'comparison';
  if (/\b(price|pricing|buy|best|top|review|reviews)\b/.test(text)) return 'commercial';
  if (/\b(sign up|template|download|tool|software)\b/.test(text)) return 'transactional';
  return 'informational';
}

export function estimateDifficulty(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  const hasBrand = /\b(google|facebook|openai|apple|amazon|microsoft)\b/i.test(keyword);
  let score = 35 + Math.max(0, 6 - words) * 8;
  if (hasBrand) score += 8;
  return Math.min(95, Math.max(12, score));
}

export function estimateSearchVolume(keyword: string, intent: KeywordIntent): number {
  const base = Math.max(120, 2200 - keyword.length * 20);
  if (intent === 'comparison') return Math.round(base * 1.15);
  if (intent === 'commercial') return Math.round(base * 1.1);
  return Math.round(base);
}
