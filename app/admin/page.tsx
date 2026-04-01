'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Clock3, FileText, PenSquare, Search, TrendingUp } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { tenantFetch } from '@/lib/client/tenant';

interface DashboardStats {
  totalKeywords: number;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  avgReadingTime: number;
}

interface DashboardPost {
  status: string;
  readingTime?: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalKeywords: 0,
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    avgReadingTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [keywordsRes, postsRes] = await Promise.all([
        tenantFetch('/api/keywords/generate'),
        tenantFetch('/api/posts/generate'),
      ]);

      const keywordsData = await keywordsRes.json();
      const postsData = await postsRes.json();

      const keywords = keywordsData.keywords || [];
      const posts: DashboardPost[] = postsData.posts || [];

      const publishedCount = posts.filter((p) => p.status === 'published').length;
      const draftCount = posts.filter((p) => p.status === 'draft').length;
      const avgReading =
        posts.length > 0
          ? Math.round(posts.reduce((sum, p) => sum + (p.readingTime || 0), 0) / posts.length)
          : 0;

      setStats({
        totalKeywords: keywords.length,
        totalPosts: posts.length,
        publishedPosts: publishedCount,
        draftPosts: draftCount,
        avgReadingTime: avgReading,
      });
    } catch (error) {
      console.error('[Admin] Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell
      title="Dashboard Overview"
      description="Track content pipeline, publishing health, and SEO output."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Keywords</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : stats.totalKeywords}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Search className="mr-1 inline h-3.5 w-3.5" />
            Research pool size
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Posts</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : stats.totalPosts}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <FileText className="mr-1 inline h-3.5 w-3.5" />
            All generated articles
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle className="text-3xl text-primary">{loading ? '-' : stats.publishedPosts}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
            Live on public blog
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : stats.draftPosts}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <PenSquare className="mr-1 inline h-3.5 w-3.5" />
            Awaiting review/publish
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Reading Time</CardDescription>
            <CardTitle className="text-3xl">{loading ? '-' : stats.avgReadingTime}m</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            Content depth estimate
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump directly to core workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg">
              <Link href="/admin/keywords">Generate Keywords</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/posts">Create Blog Post</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/admin/metrics">View SEO Metrics</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/blog">Open Public Blog</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Notes</CardTitle>
            <CardDescription>Production checklist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Keep Gemini quota monitored.</p>
            <p>2. Publish drafts regularly for metrics coverage.</p>
            <p>3. Run `update-metrics` cron weekly.</p>
            <p className="pt-2 text-foreground">
              <BarChart3 className="mr-1 inline h-4 w-4" />
              Dashboard is live and connected.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
