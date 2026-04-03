'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  marketTrendStatus?: 'up' | 'stable' | 'down' | 'no_data' | 'not_available';
  marketTrendGrowthPct?: number | null;
  marketTrendLast7?: number;
  marketTrendPrev7?: number;
  marketTrendSource?: 'google_trends' | 'tech_news' | 'none';
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

function getMarketTrendLabel(keyword: Keyword): string {
  const status = keyword.marketTrendStatus || 'not_available';
  if (status === 'up') return 'Market Up';
  if (status === 'down') return 'Market Down';
  if (status === 'stable') return 'Market Stable';
  if (status === 'no_data') return 'Market No Data';
  return 'Market N/A';
}

function getMarketTrendToneClass(keyword: Keyword): string {
  const status = keyword.marketTrendStatus || 'not_available';
  if (status === 'up') return 'text-emerald-600';
  if (status === 'down') return 'text-rose-600';
  if (status === 'stable') return 'text-amber-600';
  return 'text-muted-foreground';
}

function getMarketTrendSourceLabel(keyword: Keyword): string {
  if (keyword.marketTrendSource === 'google_trends') return 'Google Trends';
  if (keyword.marketTrendSource === 'tech_news') return 'Tech News';
  return 'Unavailable';
}

export default function KeywordsManager() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterQ, setFilterQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNiche, setFilterNiche] = useState('');
  const [filterMinDifficulty, setFilterMinDifficulty] = useState('');
  const [filterMaxDifficulty, setFilterMaxDifficulty] = useState('');
  const [appliedFilterQ, setAppliedFilterQ] = useState('');
  const [appliedFilterStatus, setAppliedFilterStatus] = useState('');
  const [appliedFilterNiche, setAppliedFilterNiche] = useState('');
  const [appliedFilterMinDifficulty, setAppliedFilterMinDifficulty] = useState('');
  const [appliedFilterMaxDifficulty, setAppliedFilterMaxDifficulty] = useState('');
  const [niche, setNiche] = useState('');
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<'mixed' | 'standard' | 'comparison'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const fetchKeywords = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('limit', '20');
      if (appliedFilterQ.trim()) params.set('q', appliedFilterQ.trim());
      if (appliedFilterStatus) params.set('status', appliedFilterStatus);
      if (appliedFilterNiche.trim()) params.set('niche', appliedFilterNiche.trim());
      if (appliedFilterMinDifficulty.trim()) params.set('minDifficulty', appliedFilterMinDifficulty.trim());
      if (appliedFilterMaxDifficulty.trim()) params.set('maxDifficulty', appliedFilterMaxDifficulty.trim());

      const res = await tenantFetch(`/api/keywords/generate?${params.toString()}`);
      const data = await res.json();
      setKeywords(data.keywords || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (fetchError) {
      console.error('[Keywords] Error fetching:', fetchError);
      setError('Unable to load keywords right now.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilterMaxDifficulty, appliedFilterMinDifficulty, appliedFilterNiche, appliedFilterQ, appliedFilterStatus]);

  useEffect(() => {
    void fetchKeywords(page);
  }, [fetchKeywords, page]);

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
        setPage(1);
        await fetchKeywords(1);
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

  function applyFilters() {
    setAppliedFilterQ(filterQ);
    setAppliedFilterStatus(filterStatus);
    setAppliedFilterNiche(filterNiche);
    setAppliedFilterMinDifficulty(filterMinDifficulty);
    setAppliedFilterMaxDifficulty(filterMaxDifficulty);
    setPage(1);
  }

  function clearFilters() {
    setFilterQ('');
    setFilterStatus('');
    setFilterNiche('');
    setFilterMinDifficulty('');
    setFilterMaxDifficulty('');
    setAppliedFilterQ('');
    setAppliedFilterStatus('');
    setAppliedFilterNiche('');
    setAppliedFilterMinDifficulty('');
    setAppliedFilterMaxDifficulty('');
    setPage(1);
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
            <CardDescription>{pagination.total} records tracked</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="mb-4 grid gap-3 rounded-lg border border-border/70 bg-background/60 p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search Keyword</label>
                <Input
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  placeholder="e.g. sandbox ai agent"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={loading}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="used">Used</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Niche</label>
                <Input
                  value={filterNiche}
                  onChange={(e) => setFilterNiche(e.target.value)}
                  placeholder="digital marketing"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Min Difficulty</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filterMinDifficulty}
                  onChange={(e) => setFilterMinDifficulty(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Difficulty</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={filterMaxDifficulty}
                  onChange={(e) => setFilterMaxDifficulty(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="md:col-span-6 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={applyFilters} disabled={loading}>
                  Apply Filters
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={clearFilters} disabled={loading}>
                  Clear
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : keywords.length > 0 ? (
              <>
                <div className="hidden space-y-3">
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
                          Market:{' '}
                          <span className={getMarketTrendToneClass(keyword)}>
                            {getMarketTrendLabel(keyword)}
                            {typeof keyword.marketTrendGrowthPct === 'number'
                              ? ` (${keyword.marketTrendGrowthPct >= 0 ? '+' : ''}${keyword.marketTrendGrowthPct}%)`
                              : ''}
                          </span>
                          <span className="text-muted-foreground">{` (${getMarketTrendSourceLabel(keyword)})`}</span>
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

                <div className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-lg border border-border/60 pb-2">
                  <Table className="min-w-[1380px] table-fixed">
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
                      <TableHead>Market</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead className="hidden xl:table-cell">Generated</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Created</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="hidden max-w-[120px] truncate font-mono text-xs text-muted-foreground lg:table-cell">
                          {keyword.id}
                        </TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal break-words align-top font-medium">
                          {keyword.keyword}
                        </TableCell>
                        <TableCell className="max-w-[180px] whitespace-normal break-words align-top">{keyword.niche}</TableCell>
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
                          <div className={`text-sm font-medium ${getMarketTrendToneClass(keyword)}`}>
                            {getMarketTrendLabel(keyword)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {typeof keyword.marketTrendGrowthPct === 'number'
                              ? `${keyword.marketTrendGrowthPct >= 0 ? '+' : ''}${keyword.marketTrendGrowthPct}%`
                              : 'n/a'}
                            {` | ${keyword.marketTrendLast7 || 0} vs ${keyword.marketTrendPrev7 || 0}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getMarketTrendSourceLabel(keyword)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{keyword.searchVolume}</div>
                          <div className="text-xs text-muted-foreground">
                            {keyword.searchVolumeSource === 'gsc'
                              ? `GSC ${keyword.searchVolumeStartDate || ''} to ${keyword.searchVolumeEndDate || ''}`
                              : 'Estimated'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">
                          {new Date(keyword.generatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                          {new Date(keyword.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                          {new Date(keyword.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={loading || page <= 1}
                    >
                      Previous 20
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                      disabled={loading || page >= pagination.totalPages}
                    >
                      Next 20
                    </Button>
                  </div>
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
