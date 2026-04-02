# KPI Usage Guide

This guide defines how to use shared dashboard UI primitives consistently.

## Components
- `KpiCard`: `components/admin-kpi-card.tsx`
- `StatusBadge`: `components/status-badge.tsx`
- Status tone maps: `lib/ui/status-maps.ts`

## KpiCard Props
- `label`: KPI title
- `value`: number/string value
- `helper`: short supporting text
- `icon`: optional Lucide icon
- `variant`: `default | compact | progress`
- `trend`: `{ value: string; direction?: 'up' | 'down' | 'neutral' }`
- `progress`: number (0-100), used with `variant="progress"`
- `progressTone`: `primary | success | warning`

## Variant Rules
- `default`: general KPI card with prominent value
- `compact`: denser KPI for contextual metrics
- `progress`: use when metric is a percentage/rate and should show bar visualization

## Trend Rules
- Use `up` when metric movement is desirable
- Use `down` when metric movement indicates risk
- Use `neutral` for informational context without directional signal
- Keep trend text short (2-5 words)

## StatusBadge Rules
- Prefer centralized maps from `lib/ui/status-maps.ts`
- Avoid inline `tonesByLabel` objects in pages unless temporary

## Example: Basic KPI
```tsx
<KpiCard
  label="Total Posts"
  value={posts.length}
  helper="Content inventory size"
  icon={FileText}
/>
```

## Example: Compact KPI With Trend
```tsx
<KpiCard
  label="Avg Read Time"
  value={`${avgReadingTime}m`}
  helper="Depth benchmark"
  variant="compact"
  trend={{ value: 'Healthy depth', direction: 'up' }}
/>
```

## Example: Progress KPI
```tsx
<KpiCard
  label="Published Rate"
  value={`${publishedRate}%`}
  helper="Live articles ratio"
  variant="progress"
  progress={publishedRate}
  progressTone="success"
  trend={{ value: 'Publishing momentum', direction: 'up' }}
/>
```

## Example: StatusBadge With Central Map
```tsx
import { postStatusTones } from '@/lib/ui/status-maps';

<StatusBadge label={post.status} tonesByLabel={postStatusTones} />
```

## Copy Checklist For New Dashboard Pages
- Add one KPI strip (`grid ... xl:grid-cols-4`)
- Use at least one non-default variant (`compact` or `progress`)
- Add trend only when signal is meaningful
- Use `StatusBadge` with centralized map
- Keep helper text concise and action-oriented
