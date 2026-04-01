import type { ExperimentVariant } from '@prisma/client';

export function calculateCtr(clicks: number, impressions: number): number {
  if (!impressions || impressions <= 0) return 0;
  return Number(((clicks / impressions) * 100).toFixed(2));
}

export function pickWinner(params: {
  impressionsA: number;
  clicksA: number;
  impressionsB: number;
  clicksB: number;
  minImpressionsEach?: number;
}): { winner: ExperimentVariant; ctrA: number; ctrB: number } {
  const { impressionsA, clicksA, impressionsB, clicksB, minImpressionsEach = 50 } = params;

  if (impressionsA < minImpressionsEach || impressionsB < minImpressionsEach) {
    throw new Error(
      `Not enough impressions. Need at least ${minImpressionsEach} per variant before selecting winner.`
    );
  }

  const ctrA = calculateCtr(clicksA, impressionsA);
  const ctrB = calculateCtr(clicksB, impressionsB);

  return {
    winner: ctrB > ctrA ? 'B' : 'A',
    ctrA,
    ctrB,
  };
}
