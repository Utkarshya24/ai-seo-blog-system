'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalKeywords: number;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  avgReadingTime: number;
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
        fetch('/api/keywords/generate'),
        fetch('/api/posts/generate'),
      ]);

      const keywordsData = await keywordsRes.json();
      const postsData = await postsRes.json();

      const keywords = keywordsData.keywords || [];
      const posts = postsData.posts || [];

      const publishedCount = posts.filter((p: any) => p.status === 'published').length;
      const draftCount = posts.filter((p: any) => p.status === 'draft').length;
      const avgReading =
        posts.length > 0
          ? Math.round(
              posts.reduce((sum: number, p: any) => sum + (p.readingTime || 0), 0) /
                posts.length
            )
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-secondary/50">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your AI SEO blog system</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? '-' : stats.totalKeywords}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? '-' : stats.totalPosts}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {loading ? '-' : stats.publishedPosts}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Drafts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? '-' : stats.draftPosts}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Reading Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? '-' : stats.avgReadingTime} min
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard Overview</CardTitle>
                <CardDescription>
                  Quick actions and system status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button asChild size="lg" variant="default">
                    <Link href="/admin/keywords">Manage Keywords</Link>
                  </Button>
                  <Button asChild size="lg" variant="default">
                    <Link href="/admin/posts">Manage Posts</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/admin/metrics">View Metrics</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/blog">View Published Blog</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keywords">
            <Card>
              <CardHeader>
                <CardTitle>Keywords Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  <Link href="/admin/keywords" className="text-primary hover:underline">
                    Go to Keywords Manager →
                  </Link>
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts">
            <Card>
              <CardHeader>
                <CardTitle>Posts Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  <Link href="/admin/posts" className="text-primary hover:underline">
                    Go to Posts Manager →
                  </Link>
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>SEO Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  <Link href="/admin/metrics" className="text-primary hover:underline">
                    Go to Metrics Dashboard →
                  </Link>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
