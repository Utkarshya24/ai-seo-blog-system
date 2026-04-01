import { OutreachStatus } from '@prisma/client';

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeDomain(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return raw;
  const clean = raw.replace(/^https?:\/\//, '').replace(/^www\./, '');
  return clean.split('/')[0] || clean;
}

export function parseStatus(value: string | null | undefined): OutreachStatus | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'PROSPECT') return OutreachStatus.PROSPECT;
  if (upper === 'CONTACTED') return OutreachStatus.CONTACTED;
  if (upper === 'FOLLOW_UP') return OutreachStatus.FOLLOW_UP;
  if (upper === 'NEGOTIATING') return OutreachStatus.NEGOTIATING;
  if (upper === 'LIVE') return OutreachStatus.LIVE;
  if (upper === 'REJECTED') return OutreachStatus.REJECTED;
  return null;
}
