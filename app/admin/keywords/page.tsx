'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleDashed, Search, Target } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';
import { keywordStatusTones } from '@/lib/ui/status-maps';

interface Keyword {
  id: string;
  keyword: string;
  niche: string;
  status: string;
  intent?: 'informational' | 'comparison' | 'commercial' | 'transactional';
  priorityScore?: number;
  difficulty: number;
  searchVolume: number;
  searchVolumeSource?: 'gsc' | 'estimated';
  searchVolumeStartDate?: string;
  searchVolumeEndDate?: string;
  trendStatus?: 'up' | 'stable' | 'down' | 'new' | 'no_data' | 'not_available';
  trendGrowthPct?: number | null;
  trendImpressionsLast7?: number;
  trendImpressionsPrev7?: number;
  trendBasis?: 'exact' | 'close_match' | 'none';
  trendCloseMatches?: Array<{ query: string; impressions: number }>;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

function getTrendLabel(keyword: Keyword): string {
  const status = keyword.trendStatus || 'not_available';
  if (status === 'up') return 'Trending Up';
  if (status === 'down') return 'Declining';
  if (status === 'stable') return 'Stable';
  if (status === 'new') return 'New Spike';
  if (status === 'no_data') return 'No GSC impressions yet';
  return 'GSC not connected';
}

function getTrendToneClass(keyword: Keyword): string {
  const status = keyword.trendStatus || 'not_available';
  if (status === 'up' || status === 'new') return 'text-emerald-600';
  if (status === 'down') return 'text-rose-600';
  if (status === 'stable') return 'text-amber-600';
  return 'text-muted-foreground';
}

export default function KeywordsManager() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState('');
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<'mixed' | 'standard' | 'comparison'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchKeywords();
  }, []);

  async function fetchKeywords() {
    setLoading(true);
    setError('');
    try {
      const res = await tenantFetch('/api/keywords/generate');
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch (fetchError) {
      console.error('[Keywords] Error fetching:', fetchError);
      setError('Unable to load keywords right now.');
    } finally {
      setLoading(false);
    }
  }

  async function generateKeywords(e: React.FormEvent) {
    e.preventDefault();
    if (!niche.trim()) return;

    setGenerating(true);
    setError('');
    try {
      const res = await tenantFetch('/api/keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, count, mode }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchKeywords();
        setNiche('');
      } else {
        setError(data.error || 'Keyword generation failed.');
        console.error('[Keywords] Generation failed:', data.error);
      }
    } catch (generateError) {
      console.error('[Keywords] Error generating:', generateError);
      setError('Keyword generation failed due to network/server issue.');
    } finally {
      setGenerating(false);
    }
  }

  const pendingCount = keywords.filter((keyword) => keyword.status === 'pending').length;
  const avgDifficulty =
    keywords.length > 0
      ? Math.round(keywords.reduce((sum, keyword) => sum + keyword.difficulty, 0) / keywords.length)
      : 0;
  const avgPriority =
    keywords.length > 0
      ? (keywords.reduce((sum, keyword) => sum + (keyword.priorityScore ?? 0), 0) / keywords.length).toFixed(1)
      : '0.0';
  const totalVolume = useMemo(
    () => keywords.reduce((sum, keyword) => sum + (keyword.searchVolume || 0), 0),
    [keywords]
  );
  const pendingRate = keywords.length > 0 ? Math.round((pendingCount / keywords.length) * 100) : 0;

  return (
    <AdminShell
      title="Keyword Intelligence"
      description="Generate and maintain a prioritized SEO keyword backlog."
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Keywords"
          value={loading ? '-' : keywords.length}
          helper="Workspace backlog size"
          icon={Search}
          trend={loading ? undefined : { value: `${pendingCount} pending`, direction: 'neutral' }}
        />
        <KpiCard
          label="Pending To Use"
          value={loading ? '-' : pendingCount}
          helper="Ready for post generation"
          icon={CircleDashed}
          variant="progress"
          progress={loading ? undefined : pendingRate}
          progressTone="warning"
          trend={
            loading
              ? undefined
              : {
                  value: pendingRate > 50 ? 'Strong backlog' : 'Backlog getting low',
                  direction: pendingRate > 50 ? 'up' : 'down',
                }
          }
        />
        <KpiCard
          label="Avg Difficulty"
          value={loading ? '-' : avgDifficulty}
          helper="Competitive complexity score"
          icon={Target}
          variant="compact"
          trend={
            loading
              ? undefined
              : {
                  value: avgDifficulty <= 45 ? 'Lower competition mix' : 'Higher competition mix',
                  direction: avgDifficulty <= 45 ? 'up' : 'down',
                }
          }
        />
        <KpiCard
          label="Total Search Volume"
          value={loading ? '-' : totalVolume.toLocaleString()}
          helper={`Avg priority ${avgPriority}`}
          icon={BarChart3}
          trend={loading ? undefined : { value: `Priority ${avgPriority}`, direction: 'up' }}
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Keywords</CardTitle>
            <CardDescription>Provide a niche and let AI suggest keyword ideas.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <form onSubmit={generateKeywords} className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Niche</label>
                <Input
                  placeholder="e.g., SaaS marketing, AI automation, local SEO"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  disabled={generating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Keyword Count</label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  disabled={generating}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'mixed' | 'standard' | 'comparison')}
                  disabled={generating}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="mixed">Mixed</option>
                  <option value="standard">Standard</option>
                  <option value="comparison">Comparison (X vs Y)</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={generating || !niche.trim()} className="w-full">
                  {generating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Generating
                    </>
                  ) : (
                    'Generate'
                  )}
                </Button>
              </div>
            </form>
            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyword Backlog</CardTitle>
            <CardDescription>{keywords.length} records tracked</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : keywords.length > 0 ? (
              <>
                <div className="space-y-3 md:hidden">
                  {keywords.map((keyword) => (
                    <div key={keyword.id} className="rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-5">{keyword.keyword}</p>
                        <StatusBadge label={keyword.status} tonesByLabel={keywordStatusTones} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <p className="text-muted-foreground">
                          Niche: <span className="text-foreground">{keyword.niche}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Intent:{' '}
                          <span className="capitalize text-foreground">
                            {keyword.intent || 'informational'}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Priority: <span className="text-foreground">{(keyword.priorityScore ?? 0).toFixed(1)}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Difficulty: <span className="text-foreground">{keyword.difficulty}</span>
                        </p>
                        <p className="col-span-2 text-muted-foreground">
                          Trend:{' '}
                          <span className={getTrendToneClass(keyword)}>
                            {getTrendLabel(keyword)}
                            {typeof keyword.trendGrowthPct === 'number' ? ` (${keyword.trendGrowthPct >= 0 ? '+' : ''}${keyword.trendGrowthPct}%)` : ''}
                            {keyword.trendBasis === 'close_match' ? ' [Close Match]' : ''}
                          </span>
                        </p>
                        <p className="col-span-2 text-muted-foreground">
                          7d Impr: <span className="text-foreground">{(keyword.trendImpressionsLast7 || 0).toLocaleString()}</span> | Prev 7d:{' '}
                          <span className="text-foreground">{(keyword.trendImpressionsPrev7 || 0).toLocaleString()}</span>
                        </p>
                        {keyword.trendCloseMatches && keyword.trendCloseMatches.length > 0 ? (
                          <p className="col-span-2 text-muted-foreground">
                            Close matches:{' '}
                            <span className="text-foreground">
                              {keyword.trendCloseMatches
                                .map((item) => `${item.query} (${item.impressions})`)
                                .join(', ')}
                            </span>
                          </p>
                        ) : null}
                        <p className="col-span-2 text-muted-foreground">
                          Search Volume:{' '}
                          <span className="text-foreground">
                            {keyword.searchVolume} ({keyword.searchVolumeSource === 'gsc' ? 'GSC' : 'Estimated'})
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border/60 pb-2 md:block">
                  <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden lg:table-cell">ID</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead className="hidden md:table-cell">Generated</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="hidden max-w-[120px] truncate font-mono text-xs text-muted-foreground lg:table-cell">
                          {keyword.id}
                        </TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal break-words font-medium">
                          {keyword.keyword}
                        </TableCell>
                        <TableCell className="max-w-[140px] whitespace-normal break-words">{keyword.niche}</TableCell>
                        <TableCell>
                          <StatusBadge label={keyword.status} tonesByLabel={keywordStatusTones} />
                        </TableCell>
                        <TableCell className="capitalize">{keyword.intent || 'informational'}</TableCell>
                        <TableCell>{(keyword.priorityScore ?? 0).toFixed(1)}</TableCell>
                        <TableCell>{keyword.difficulty}</TableCell>
                        <TableCell>
                          <div className={`text-sm font-medium ${getTrendToneClass(keyword)}`}>
                            {getTrendLabel(keyword)}
                            {keyword.trendBasis === 'close_match' ? ' [Close Match]' : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {typeof keyword.trendGrowthPct === 'number'
                              ? `${keyword.trendGrowthPct >= 0 ? '+' : ''}${keyword.trendGrowthPct}%`
                              : 'n/a'}
                            {` | ${keyword.trendImpressionsLast7 || 0} vs ${keyword.trendImpressionsPrev7 || 0}`}
                          </div>
                          {keyword.trendCloseMatches && keyword.trendCloseMatches.length > 0 ? (
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {keyword.trendCloseMatches
                                .map((item) => `${item.query} (${item.impressions})`)
                                .join(', ')}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{keyword.searchVolume}</div>
                          <div className="text-xs text-muted-foreground">
                            {keyword.searchVolumeSource === 'gsc'
                              ? `GSC ${keyword.searchVolumeStartDate || ''} to ${keyword.searchVolumeEndDate || ''}`
                              : 'Estimated'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {new Date(keyword.generatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {new Date(keyword.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {new Date(keyword.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No keywords yet. Generate your first batch.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
