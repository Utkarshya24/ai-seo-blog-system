import { ArrowDownRight, ArrowUpRight, LucideIcon, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type KpiCardVariant = 'default' | 'compact' | 'progress';
type KpiTrendDirection = 'up' | 'down' | 'neutral';
type KpiProgressTone = 'primary' | 'success' | 'warning';

interface KpiCardProps {
  label: string;
  value: string | number;
  helper: string;
  icon?: LucideIcon;
  variant?: KpiCardVariant;
  trend?: { value: string; direction?: KpiTrendDirection };
  progress?: number;
  progressTone?: KpiProgressTone;
  valueClassName?: string;
  className?: string;
}

const progressToneClass: Record<KpiProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

const trendToneClass: Record<KpiTrendDirection, string> = {
  up: 'text-emerald-600',
  down: 'text-rose-600',
  neutral: 'text-muted-foreground',
};

export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  variant = 'default',
  trend,
  progress,
  progressTone = 'primary',
  valueClassName,
  className,
}: KpiCardProps) {
  const resolvedTrendDirection = trend?.direction || 'neutral';
  const TrendIcon =
    resolvedTrendDirection === 'up'
      ? ArrowUpRight
      : resolvedTrendDirection === 'down'
        ? ArrowDownRight
        : Minus;
  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(progress, 100)) : undefined;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            'flex items-center justify-between text-3xl',
            variant === 'compact' && 'text-2xl',
            valueClassName
          )}
        >
          <span>{value}</span>
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p>{helper}</p>
        {trend ? (
          <p className={cn('inline-flex items-center font-medium', trendToneClass[resolvedTrendDirection])}>
            <TrendIcon className="mr-1 h-3.5 w-3.5" />
            {trend.value}
          </p>
        ) : null}
        {variant === 'progress' && typeof progressValue === 'number' ? (
          <div>
            <div className="mb-1 flex justify-between">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressValue}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div
                className={cn('h-2 rounded-full', progressToneClass[progressTone])}
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
