import { AiProvider } from '@prisma/client';

export function parseProvider(value: string): AiProvider {
  const upper = value.trim().toUpperCase();
  if (upper === 'CHATGPT') return AiProvider.CHATGPT;
  if (upper === 'PERPLEXITY') return AiProvider.PERPLEXITY;
  if (upper === 'GEMINI') return AiProvider.GEMINI;
  if (upper === 'CLAUDE') return AiProvider.CLAUDE;
  return AiProvider.OTHER;
}

export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function hostFromUrl(input: string): string | null {
  try {
    return new URL(normalizeUrl(input)).host.toLowerCase();
  } catch {
    return null;
  }
}
