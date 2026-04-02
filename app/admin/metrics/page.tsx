'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Clock3,
  FlaskConical,
  MousePointerClick,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';
import {
  opportunitySeverityTones,
  serpExperimentStatusTones,
} from '@/lib/ui/status-maps';

interface Metrics {
  postId: string;
  views: number;
  clicks: number;
  ctr?: number;
  source?: string;
  avgTimeOnPage: number;
  bounceRate: number;
  updatedAt: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
}

interface Opportunity {
  postId: string;
  title: string;
  slug: string;
  keyword: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  severity: 'high' | 'medium' | 'low';
  missedClicks: number;
}

interface SerpExperiment {
  id: string;
  postId: string;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  variantATitle: string;
  variantAMetaDescription: string;
  variantBTitle: string;
  variantBMetaDescription: string;
  impressionsA: number;
  clicksA: number;
  impressionsB: number;
  clicksB: number;
  ctrA: number;
  ctrB: number;
  winner: 'A' | 'B' | null;
  startedAt: string;
  completedAt: string | null;
  post?: { title: string; slug: string };
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [experiments, setExperiments] = useState<SerpExperiment[]>([]);
  const [optimizingPostId, setOptimizingPostId] = useState<string | null>(null);
  const [startingExperimentPostId, setStartingExperimentPostId] = useState<string | null>(null);
  const [savingExperimentId, setSavingExperimentId] = useState<string | null>(null);
  const [selectingWinnerId, setSelectingWinnerId] = useState<string | null>(null);
  const [experimentDrafts, setExperimentDrafts] = useState<
    Record<string, { impressionsA: string; clicksA: string; impressionsB: string; clicksB: string }>
  >({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [metricsRes, postsRes] = await Promise.all([
        tenantFetch('/api/metrics'),
        tenantFetch('/api/posts/generate?status=published'),
      ]);

      const metricsData = await metricsRes.json();
      const postsData = await postsRes.json();

      setMetrics(metricsData.metrics || []);
      setPosts(postsData.posts || []);

      const oppRes = await tenantFetch('/api/seo/opportunities');
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setOpportunities(oppData.opportunities || []);
      } else {
        setOpportunities([]);
      }

      const expRes = await tenantFetch('/api/experiments/serp');
      if (expRes.ok) {
        const expData = await expRes.json();
        const rows: SerpExperiment[] = expData.experiments || [];
        setExperiments(rows);
        setExperimentDrafts((prev) => {
          const next = { ...prev };
          for (const exp of rows) {
            if (!next[exp.id]) {
              next[exp.id] = {
                impressionsA: String(exp.impressionsA),
                clicksA: String(exp.clicksA),
                impressionsB: String(exp.impressionsB),
                clicksB: String(exp.clicksB),
              };
            }
          }
          return next;
        });
      } else {
        setExperiments([]);
      }
    } catch (error) {
      console.error('[Metrics] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }

  async function optimizeSerp(postId: string) {
    setOptimizingPostId(postId);
    setMessage('');
    try {
      const res = await tenantFetch('/api/posts/optimize-serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Optimization failed.');
        return;
      }
      setMessage('SERP optimization applied. Refreshing metrics list...');
      await fetchData();
    } catch (error) {
      console.error('[Metrics] optimizeSerp error:', error);
      setMessage('Optimization failed due to network/server issue.');
    } finally {
      setOptimizingPostId(null);
    }
  }

  async function startExperiment(postId: string) {
    setStartingExperimentPostId(postId);
    setMessage('');
    try {
      const res = await tenantFetch('/api/experiments/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to start A/B experiment.');
        return;
      }
      setMessage('A/B experiment started.');
      await fetchData();
    } catch (error) {
      console.error('[Metrics] startExperiment error:', error);
      setMessage('Failed to start A/B experiment.');
    } finally {
      setStartingExperimentPostId(null);
    }
  }

  async function saveExperimentData(experimentId: string) {
    const draft = experimentDrafts[experimentId];
    if (!draft) return;
    setSavingExperimentId(experimentId);
    setMessage('');
    try {
      const res = await tenantFetch(`/api/experiments/serp/${experimentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          impressionsA: Number(draft.impressionsA || 0),
          clicksA: Number(draft.clicksA || 0),
          impressionsB: Number(draft.impressionsB || 0),
          clicksB: Number(draft.clicksB || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to save A/B data.');
        return;
      }
      setMessage('A/B test data saved.');
      await fetchData();
    } catch (error) {
      console.error('[Metrics] saveExperimentData error:', error);
      setMessage('Failed to save A/B data.');
    } finally {
      setSavingExperimentId(null);
    }
  }

  async function selectWinner(experimentId: string) {
    setSelectingWinnerId(experimentId);
    setMessage('');
    try {
      const res = await tenantFetch(`/api/experiments/serp/${experimentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'select-winner',
          minImpressionsEach: 50,
          applyWinner: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to select winner.');
        return;
      }
      setMessage(`Winner selected: Variant ${data.winner}. Post metadata updated.`);
      await fetchData();
    } catch (error) {
      console.error('[Metrics] selectWinner error:', error);
      setMessage('Failed to select winner.');
    } finally {
      setSelectingWinnerId(null);
    }
  }

  const getPostTitle = (postId: string) => posts.find((post) => post.id === postId)?.title || 'Unknown Post';
  const getPostSlug = (postId: string) => posts.find((post) => post.id === postId)?.slug || '';

  const totalViews = metrics.reduce((sum, metric) => sum + metric.views, 0);
  const totalClicks = metrics.reduce((sum, metric) => sum + metric.clicks, 0);
  const avgBounceRate =
    metrics.length > 0
      ? (metrics.reduce((sum, metric) => sum + metric.bounceRate, 0) / metrics.length).toFixed(1)
      : '0';
  const avgTimeOnPage =
    metrics.length > 0
      ? (metrics.reduce((sum, metric) => sum + metric.avgTimeOnPage, 0) / metrics.length).toFixed(1)
      : '0';
  const overallCtr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';
  const bounceRateNumber = Number(avgBounceRate);

  const totalMissedClicks = opportunities.reduce((sum, item) => sum + item.missedClicks, 0);
  const highSeverityCount = opportunities.filter((item) => item.severity === 'high').length;
  const runningExperiments = experiments.filter((exp) => exp.status === 'RUNNING').length;
  const completedExperiments = experiments.filter((exp) => exp.status === 'COMPLETED').length;

  const topThreeOpportunities = useMemo(
    () => [...opportunities].sort((a, b) => b.missedClicks - a.missedClicks).slice(0, 3),
    [opportunities]
  );

  return (
    <AdminShell
      title="SEO Performance"
      description="Observe post-level visibility, engagement, and retention trends."
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Views"
          value={loading ? '-' : totalViews.toLocaleString()}
          helper="Across all tracked posts"
          icon={TrendingUp}
          trend={loading ? undefined : { value: `${metrics.length} tracked posts`, direction: 'up' }}
        />
        <KpiCard
          label="Total Clicks"
          value={loading ? '-' : totalClicks.toLocaleString()}
          helper="Search click interactions"
          icon={MousePointerClick}
          trend={loading ? undefined : { value: `${overallCtr}% overall CTR`, direction: 'up' }}
        />
        <KpiCard
          label="Avg Time On Page"
          value={loading ? '-' : `${avgTimeOnPage}s`}
          helper="Audience attention span"
          icon={Clock3}
          variant="compact"
          trend={loading ? undefined : { value: 'Session depth signal', direction: 'neutral' }}
        />
        <KpiCard
          label="Avg Bounce Rate"
          value={loading ? '-' : `${avgBounceRate}%`}
          helper="Exit probability signal"
          icon={Activity}
          variant="progress"
          progress={loading ? undefined : bounceRateNumber}
          progressTone="warning"
          trend={
            loading
              ? undefined
              : {
                  value: bounceRateNumber <= 45 ? 'Healthy range' : 'Needs reduction',
                  direction: bounceRateNumber <= 45 ? 'up' : 'down',
                }
          }
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Opportunity Pulse
            </CardTitle>
            <CardDescription>Fast signal for where click gains are available.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Total Opportunities</p>
              <p className="text-2xl font-semibold">{loading ? '-' : opportunities.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">High Severity</p>
              <p className="text-2xl font-semibold text-rose-600">{loading ? '-' : highSeverityCount}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Potential Click Recovery</p>
              <p className="text-2xl font-semibold text-emerald-600">{loading ? '-' : `+${totalMissedClicks}`}</p>
            </div>

            {topThreeOpportunities.length > 0 ? (
              <div className="sm:col-span-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Top Recovery Candidates</p>
                {topThreeOpportunities.map((item) => (
                  <div
                    key={item.postId}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                  >
                    <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                    <StatusBadge label={item.severity} tonesByLabel={opportunitySeverityTones} />
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Experiment Health
            </CardTitle>
            <CardDescription>Live status of SERP metadata experiments.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Running</p>
              <p className="text-2xl font-semibold text-sky-600">{loading ? '-' : runningExperiments}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-semibold text-emerald-600">{loading ? '-' : completedExperiments}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Total Experiments</p>
              <p className="text-2xl font-semibold">{loading ? '-' : experiments.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Post Performance Table</CardTitle>
          <CardDescription>Detailed metrics by published article.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : metrics.length > 0 ? (
            <div className="max-w-full overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead className="hidden md:table-cell">Source</TableHead>
                    <TableHead className="hidden md:table-cell">Avg Time</TableHead>
                    <TableHead className="hidden lg:table-cell">Bounce Rate</TableHead>
                    <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => {
                    const ctr =
                      typeof metric.ctr === 'number'
                        ? metric.ctr.toFixed(1)
                        : metric.views > 0
                          ? ((metric.clicks / metric.views) * 100).toFixed(1)
                          : '0';
                    const slug = getPostSlug(metric.postId);

                    return (
                      <TableRow key={metric.postId}>
                        <TableCell className="max-w-[220px] font-medium whitespace-normal break-words">
                          {slug ? (
                            <Link href={`/blog/${slug}`} className="line-clamp-1 text-primary hover:underline">
                              {getPostTitle(metric.postId)}
                            </Link>
                          ) : (
                            getPostTitle(metric.postId)
                          )}
                        </TableCell>
                        <TableCell>{metric.views.toLocaleString()}</TableCell>
                        <TableCell>{metric.clicks.toLocaleString()}</TableCell>
                        <TableCell>{ctr}%</TableCell>
                        <TableCell className="hidden uppercase md:table-cell">{metric.source || 'manual'}</TableCell>
                        <TableCell className="hidden md:table-cell">{metric.avgTimeOnPage.toFixed(1)}s</TableCell>
                        <TableCell className="hidden lg:table-cell">{metric.bounceRate.toFixed(1)}%</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {new Date(metric.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No metrics yet. Publish posts and run metrics updates.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>CTR Opportunities</CardTitle>
          <CardDescription>High-impression pages where title/meta updates can win more clicks.</CardDescription>
        </CardHeader>
        <CardContent>
          {message ? (
            <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {message}
            </p>
          ) : null}
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : opportunities.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No immediate CTR opportunities detected.</p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[940px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="hidden md:table-cell">Keyword</TableHead>
                    <TableHead>Impr.</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead className="hidden md:table-cell">Pos.</TableHead>
                    <TableHead>Potential Clicks</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.slice(0, 20).map((opportunity) => (
                    <TableRow key={opportunity.postId}>
                      <TableCell className="max-w-[220px] font-medium whitespace-normal break-words">
                        <Link href={`/blog/${opportunity.slug}`} className="line-clamp-1 text-primary hover:underline">
                          {opportunity.title}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden max-w-[180px] truncate md:table-cell">{opportunity.keyword}</TableCell>
                      <TableCell>{opportunity.impressions.toLocaleString()}</TableCell>
                      <TableCell>{opportunity.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="hidden md:table-cell">{opportunity.position.toFixed(1)}</TableCell>
                      <TableCell className="font-medium text-emerald-700">+{opportunity.missedClicks}</TableCell>
                      <TableCell>
                        <StatusBadge label={opportunity.severity} tonesByLabel={opportunitySeverityTones} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => optimizeSerp(opportunity.postId)}
                            disabled={optimizingPostId === opportunity.postId}
                          >
                            {optimizingPostId === opportunity.postId ? 'Optimizing...' : 'Optimize'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startExperiment(opportunity.postId)}
                            disabled={startingExperimentPostId === opportunity.postId}
                          >
                            {startingExperimentPostId === opportunity.postId ? 'Starting...' : 'Start A/B'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>SERP A/B Experiments</CardTitle>
          <CardDescription>Track variant performance and apply winner to live metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : experiments.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No SERP experiments yet. Start one from opportunities table.</p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variant A (Impr/Clicks/CTR)</TableHead>
                    <TableHead>Variant B (Impr/Clicks/CTR)</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiments.map((experiment) => {
                    const draft = experimentDrafts[experiment.id] || {
                      impressionsA: String(experiment.impressionsA),
                      clicksA: String(experiment.clicksA),
                      impressionsB: String(experiment.impressionsB),
                      clicksB: String(experiment.clicksB),
                    };

                    return (
                      <TableRow key={experiment.id}>
                        <TableCell className="max-w-xs font-medium">
                          {experiment.post?.slug ? (
                            <Link
                              href={`/blog/${experiment.post.slug}`}
                              className="line-clamp-1 text-primary hover:underline"
                            >
                              {experiment.post.title}
                            </Link>
                          ) : (
                            experiment.postId
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge label={experiment.status} tonesByLabel={serpExperimentStatusTones} />
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              className="h-8 text-xs"
                              value={draft.impressionsA}
                              onChange={(e) =>
                                setExperimentDrafts((prev) => ({
                                  ...prev,
                                  [experiment.id]: { ...draft, impressionsA: e.target.value },
                                }))
                              }
                              placeholder="Impressions A"
                              disabled={experiment.status !== 'RUNNING'}
                            />
                            <Input
                              className="h-8 text-xs"
                              value={draft.clicksA}
                              onChange={(e) =>
                                setExperimentDrafts((prev) => ({
                                  ...prev,
                                  [experiment.id]: { ...draft, clicksA: e.target.value },
                                }))
                              }
                              placeholder="Clicks A"
                              disabled={experiment.status !== 'RUNNING'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">CTR: {experiment.ctrA.toFixed(2)}%</p>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              className="h-8 text-xs"
                              value={draft.impressionsB}
                              onChange={(e) =>
                                setExperimentDrafts((prev) => ({
                                  ...prev,
                                  [experiment.id]: { ...draft, impressionsB: e.target.value },
                                }))
                              }
                              placeholder="Impressions B"
                              disabled={experiment.status !== 'RUNNING'}
                            />
                            <Input
                              className="h-8 text-xs"
                              value={draft.clicksB}
                              onChange={(e) =>
                                setExperimentDrafts((prev) => ({
                                  ...prev,
                                  [experiment.id]: { ...draft, clicksB: e.target.value },
                                }))
                              }
                              placeholder="Clicks B"
                              disabled={experiment.status !== 'RUNNING'}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">CTR: {experiment.ctrB.toFixed(2)}%</p>
                        </TableCell>
                        <TableCell className="font-medium">{experiment.winner || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveExperimentData(experiment.id)}
                              disabled={experiment.status !== 'RUNNING' || savingExperimentId === experiment.id}
                            >
                              {savingExperimentId === experiment.id ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => selectWinner(experiment.id)}
                              disabled={experiment.status !== 'RUNNING' || selectingWinnerId === experiment.id}
                            >
                              {selectingWinnerId === experiment.id ? 'Selecting...' : 'Pick Winner'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {highSeverityCount > 0 ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              {highSeverityCount} high-severity opportunities are currently waiting for action.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
