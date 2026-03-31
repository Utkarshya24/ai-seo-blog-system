'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';

interface Metrics {
  postId: string;
  views: number;
  clicks: number;
  avgTimeOnPage: number;
  bounceRate: number;
  updatedAt: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
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
        fetch('/api/metrics'),
        fetch('/api/posts/generate?status=published'),
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

  const getPostTitle = (postId: string) => {
    return posts.find((p) => p.id === postId)?.title || 'Unknown Post';
  };

  const getPostSlug = (postId: string) => {
    return posts.find((p) => p.id === postId)?.slug || '';
  };

  const totalViews = metrics.reduce((sum, m) => sum + m.views, 0);
  const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
  const avgBounceRate =
    metrics.length > 0
      ? (metrics.reduce((sum, m) => sum + m.bounceRate, 0) / metrics.length).toFixed(1)
      : '0';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-secondary/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin" className="text-sm text-primary hover:underline">
                ← Back to Dashboard
              </Link>
              <h1 className="mt-2 text-3xl font-bold text-foreground">
                SEO Metrics
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {loading ? '-' : totalViews.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Across all published posts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {loading ? '-' : totalClicks.toLocaleString()}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Cumulative CTR from search
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Bounce Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {loading ? '-' : avgBounceRate}%
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Average across all posts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Post Performance</CardTitle>
            <CardDescription>
              Detailed metrics for each published post
            </CardDescription>
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
                      <TableHead>Post Title</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>Avg Time</TableHead>
                      <TableHead>Bounce Rate</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric) => {
                      const ctr =
                        metric.views > 0
                          ? ((metric.clicks / metric.views) * 100).toFixed(1)
                          : '0';
                      const slug = getPostSlug(metric.postId);

                      return (
                        <TableRow key={metric.postId}>
                          <TableCell className="font-medium max-w-xs truncate">
                            {slug ? (
                              <Link
                                href={`/blog/${slug}`}
                                className="text-primary hover:underline"
                              >
                                {getPostTitle(metric.postId)}
                              </Link>
                            ) : (
                              getPostTitle(metric.postId)
                            )}
                          </TableCell>
                          <TableCell>{metric.views.toLocaleString()}</TableCell>
                          <TableCell>{metric.clicks.toLocaleString()}</TableCell>
                          <TableCell>{ctr}%</TableCell>
                          <TableCell>
                            {metric.avgTimeOnPage.toFixed(1)}s
                          </TableCell>
                          <TableCell>{metric.bounceRate.toFixed(1)}%</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(metric.updatedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No metrics available yet. Publish some posts to start tracking metrics!
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
