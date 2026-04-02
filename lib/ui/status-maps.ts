export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'indigo';

export const keywordStatusTones: Record<string, StatusTone> = {
  pending: 'warning',
  used: 'success',
  draft: 'info',
};

export const postStatusTones: Record<string, StatusTone> = {
  draft: 'info',
  published: 'success',
  scheduled: 'warning',
};

export const opportunitySeverityTones: Record<string, StatusTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
};

export const serpExperimentStatusTones: Record<string, StatusTone> = {
  RUNNING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export const outreachStatusTones: Record<string, StatusTone> = {
  LIVE: 'success',
  NEGOTIATING: 'info',
  FOLLOW_UP: 'warning',
  REJECTED: 'danger',
  CONTACTED: 'indigo',
  PROSPECT: 'neutral',
};
