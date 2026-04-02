'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
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
  id: string;
  title: string;
  status: string;
  readingTime?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalKeywords: 0,
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    avgReadingTime: 0,
  });
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStats();
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
      const postRows: DashboardPost[] = postsData.posts || [];

      const publishedCount = postRows.filter((p) => p.status === 'published').length;
      const draftCount = postRows.filter((p) => p.status === 'draft').length;
      const avgReading =
        postRows.length > 0
          ? Math.round(postRows.reduce((sum, p) => sum + (p.readingTime || 0), 0) / postRows.length)
          : 0;

      setStats({
        totalKeywords: keywords.length,
        totalPosts: postRows.length,
        publishedPosts: publishedCount,
        draftPosts: draftCount,
        avgReadingTime: avgReading,
      });
      setPosts(postRows);
    } catch (error) {
      console.error('[Admin] Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const publishedRate = stats.totalPosts > 0 ? Math.round((stats.publishedPosts / stats.totalPosts) * 100) : 0;
  const draftRate = stats.totalPosts > 0 ? Math.round((stats.draftPosts / stats.totalPosts) * 100) : 0;
  const coverageRatio =
    stats.totalKeywords > 0 ? Math.round((stats.totalPosts / stats.totalKeywords) * 100) : 0;

  const statCards = [
    {
      label: 'Keyword Backlog',
      value: loading ? '-' : `${stats.totalKeywords}`,
      helper: 'Research pool ready',
      icon: Search,
      variant: 'default' as const,
    },
    {
      label: 'Content Assets',
      value: loading ? '-' : `${stats.totalPosts}`,
      helper: 'Total generated posts',
      icon: FileText,
      trend: loading
        ? undefined
        : { value: `${stats.publishedPosts} published`, direction: 'up' as const },
      variant: 'default' as const,
    },
    {
      label: 'Published Rate',
      value: loading ? '-' : `${publishedRate}%`,
      helper: `${stats.publishedPosts} live articles`,
      icon: TrendingUp,
      progress: loading ? undefined : publishedRate,
      progressTone: 'success' as const,
      variant: 'progress' as const,
    },
    {
      label: 'Avg Read Time',
      value: loading ? '-' : `${stats.avgReadingTime}m`,
      helper: 'Estimated depth',
      icon: Clock3,
      variant: 'compact' as const,
    },
  ];

  const recentPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [posts]);

  return (
    <AdminShell
      title="Dashboard Overview"
      description="Track SEO execution, publishing momentum, and next actions from one control center."
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {statCards.map((item) => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            icon={item.icon}
            variant={item.variant}
            trend={item.trend}
            progress={item.progress}
            progressTone={item.progressTone}
            className="border-border/70 bg-card/85"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Publishing Funnel
            </CardTitle>
            <CardDescription>Instant visibility on throughput and bottlenecks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Published Progress</span>
                <span className="font-medium">{loading ? '-' : `${publishedRate}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${publishedRate}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Draft Inventory</span>
                <span className="font-medium">{loading ? '-' : `${draftRate}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${draftRate}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Keyword Coverage</span>
                <span className="font-medium">{loading ? '-' : `${coverageRatio}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(coverageRatio, 100)}%` }} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Published</p>
                <p className="text-lg font-semibold text-emerald-600">{loading ? '-' : stats.publishedPosts}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Drafts</p>
                <p className="text-lg font-semibold text-amber-600">{loading ? '-' : stats.draftPosts}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Pipeline Gap</p>
                <p className="text-lg font-semibold text-foreground">
                  {loading ? '-' : Math.max(stats.totalKeywords - stats.totalPosts, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Action Center
            </CardTitle>
            <CardDescription>High-impact shortcuts for the ops team.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild className="justify-start">
              <Link href="/admin/keywords">Generate New Keywords</Link>
            </Button>
            <Button asChild className="justify-start" variant="outline">
              <Link href="/admin/posts">Create And Review Drafts</Link>
            </Button>
            <Button asChild className="justify-start" variant="outline">
              <Link href="/admin/metrics">Run SERP Optimization</Link>
            </Button>
            <Button asChild className="justify-start" variant="outline">
              <Link href="/admin/visibility">Check AI Visibility</Link>
            </Button>
            <Button asChild className="justify-start" variant="outline">
              <Link href="/blog">Open Public Blog</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle>Recent Content Activity</CardTitle>
            <CardDescription>Latest updated posts in your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : recentPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No post activity yet.</p>
            ) : (
              recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                >
                  <div>
                    <p className="line-clamp-1 text-sm font-medium">{post.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(post.updatedAt || post.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      post.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Weekly Operating Checklist
            </CardTitle>
            <CardDescription>Minimum rhythm for a healthy content engine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="font-medium">1. Fill top-of-funnel backlog</p>
              <p className="text-xs text-muted-foreground">Generate and score at least 15 fresh keywords.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="font-medium">2. Move drafts to publish</p>
              <p className="text-xs text-muted-foreground">Keep draft ratio below 40% to avoid stale pipeline.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="font-medium">3. Optimize winners</p>
              <p className="text-xs text-muted-foreground">Run SERP optimization on top-performing published posts.</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="font-medium">4. Monitor AI visibility</p>
              <p className="text-xs text-muted-foreground">Track mentions and missed entities weekly.</p>
            </div>
            <div className="pt-1 text-xs text-muted-foreground">
              <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
              Cadence-driven execution improves compounding SEO output.
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
