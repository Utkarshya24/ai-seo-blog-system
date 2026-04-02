import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'indigo';

const toneClass: Record<StatusTone, string> = {
  neutral: 'bg-slate-200 text-slate-700',
  info: 'bg-sky-100 text-sky-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  tonesByLabel?: Record<string, StatusTone>;
  className?: string;
}

export function StatusBadge({
  label,
  tone = 'neutral',
  tonesByLabel,
  className,
}: StatusBadgeProps) {
  const resolvedTone = tonesByLabel?.[label] || tone;
  return <Badge className={cn(toneClass[resolvedTone], className)}>{label}</Badge>;
}
