'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock3, MousePointerClick, TrendingUp } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

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
    fetchData();
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
    metrics.length > 0 ? (metrics.reduce((sum, metric) => sum + metric.bounceRate, 0) / metrics.length).toFixed(1) : '0';
  const avgTimeOnPage =
    metrics.length > 0 ? (metrics.reduce((sum, metric) => sum + metric.avgTimeOnPage, 0) / metrics.length).toFixed(1) : '0';

  return (
    <AdminShell
      title="SEO Performance"
      description="Observe post-level visibility, engagement, and retention trends."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Views</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : totalViews.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
            Across all tracked posts
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Clicks</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : totalClicks.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <MousePointerClick className="mr-1 inline h-3.5 w-3.5" />
            Search click interactions
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Time On Page</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : `${avgTimeOnPage}s`}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            Audience attention span
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Bounce Rate</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : `${avgBounceRate}%`}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Activity className="mr-1 inline h-3.5 w-3.5" />
            Exit probability signal
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Avg Time</TableHead>
                    <TableHead>Bounce Rate</TableHead>
                    <TableHead>Updated</TableHead>
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
                        <TableCell className="max-w-xs font-medium">
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
                        <TableCell className="uppercase">{metric.source || 'manual'}</TableCell>
                        <TableCell>{metric.avgTimeOnPage.toFixed(1)}s</TableCell>
                        <TableCell>{metric.bounceRate.toFixed(1)}%</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(metric.updatedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              No metrics yet. Publish posts and run metrics updates.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Impr.</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Pos.</TableHead>
                    <TableHead>Potential Clicks</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.slice(0, 20).map((opportunity) => (
                    <TableRow key={opportunity.postId}>
                      <TableCell className="max-w-xs font-medium">
                        <Link href={`/blog/${opportunity.slug}`} className="line-clamp-1 text-primary hover:underline">
                          {opportunity.title}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">{opportunity.keyword}</TableCell>
                      <TableCell>{opportunity.impressions.toLocaleString()}</TableCell>
                      <TableCell>{opportunity.ctr.toFixed(2)}%</TableCell>
                      <TableCell>{opportunity.position.toFixed(1)}</TableCell>
                      <TableCell>+{opportunity.missedClicks}</TableCell>
                      <TableCell className="uppercase">{opportunity.severity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => optimizeSerp(opportunity.postId)}
                            disabled={optimizingPostId === opportunity.postId}
                          >
                            {optimizingPostId === opportunity.postId ? 'Optimizing...' : 'Optimize SERP'}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => startExperiment(opportunity.postId)}
                            disabled={startingExperimentPostId === opportunity.postId}
                          >
                            {startingExperimentPostId === opportunity.postId ? 'Starting...' : 'Start A/B'}
                          </button>
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

      <Card className="mt-6">
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variant A (Impr/Clicks/CTR)</TableHead>
                    <TableHead>Variant B (Impr/Clicks/CTR)</TableHead>
                    <TableHead>Winner</TableHead>
                    <TableHead>Action</TableHead>
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
                            <Link href={`/blog/${experiment.post.slug}`} className="line-clamp-1 text-primary hover:underline">
                              {experiment.post.title}
                            </Link>
                          ) : (
                            experiment.postId
                          )}
                        </TableCell>
                        <TableCell>{experiment.status}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
                            <input
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
                            <input
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
                            <input
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
                        <TableCell>{experiment.winner || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => saveExperimentData(experiment.id)}
                              disabled={experiment.status !== 'RUNNING' || savingExperimentId === experiment.id}
                            >
                              {savingExperimentId === experiment.id ? 'Saving...' : 'Save Data'}
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => selectWinner(experiment.id)}
                              disabled={experiment.status !== 'RUNNING' || selectingWinnerId === experiment.id}
                            >
                              {selectingWinnerId === experiment.id ? 'Selecting...' : 'Select Winner'}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
