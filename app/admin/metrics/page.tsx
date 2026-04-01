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

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
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
    } catch (error) {
      console.error('[Metrics] Error fetching:', error);
    } finally {
      setLoading(false);
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
    </AdminShell>
  );
}
