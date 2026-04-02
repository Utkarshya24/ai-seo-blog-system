'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Flame, Hash, Newspaper } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { tenantFetch } from '@/lib/client/tenant';

interface TechNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string | null;
  publishedAt: string | null;
  score: number;
  fetchedAt: string;
}

export default function TechNewsPage() {
  const [items, setItems] = useState<TechNewsItem[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await tenantFetch('/api/tech-news?limit=25');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load tech trends.');
        return;
      }
      setItems(data.items || []);
      setKeywords(data.trendingKeywords || []);
      setSelectedKeyword((current) => current || data.trendingKeywords?.[0] || '');
      setGeneratedAt(data.generatedAt || null);
    } catch (loadError) {
      console.error('[TechNews] loadData error:', loadError);
      setError('Failed to load tech trends.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshNow() {
    setRefreshing(true);
    setError('');
    try {
      const res = await tenantFetch('/api/tech-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPerSource: 12 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to refresh tech trends.');
        return;
      }
      setItems(data.items || []);
      setKeywords(data.trendingKeywords || []);
      setSelectedKeyword((current) => current || data.trendingKeywords?.[0] || '');
      setGeneratedAt(data.generatedAt || null);
    } catch (refreshError) {
      console.error('[TechNews] refreshNow error:', refreshError);
      setError('Failed to refresh tech trends.');
    } finally {
      setRefreshing(false);
    }
  }

  async function generateKeywordsFromTrend() {
    if (!selectedKeyword) return;
    setGeneratingKeywords(true);
    setError('');
    setNotice('');
    try {
      const res = await tenantFetch('/api/keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: selectedKeyword,
          count: 8,
          mode: 'mixed',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate keywords from trend.');
        return;
      }
      const generatedCount = Number(data.count || 0);
      setNotice(`Generated ${generatedCount} keywords for trend: "${selectedKeyword}".`);
    } catch (generateError) {
      console.error('[TechNews] generateKeywordsFromTrend error:', generateError);
      setError('Failed to generate keywords from trend.');
    } finally {
      setGeneratingKeywords(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const highSignalStories = items.filter((item) => item.score >= 70).length;
  const highSignalRate = items.length > 0 ? Math.round((highSignalStories / items.length) * 100) : 0;

  return (
    <AdminShell
      title="Tech News"
      description="Trending technology topics aggregated every 2 hours for keyword and content planning."
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Stories"
            value={loading ? '-' : items.length}
            helper="Fetched trend articles"
            icon={Newspaper}
            trend={loading ? undefined : { value: `${keywords.length} keyword signals`, direction: 'up' }}
          />
          <KpiCard
            label="Trending Keywords"
            value={loading ? '-' : keywords.length}
            helper="Detected from feeds"
            icon={Hash}
            variant="compact"
          />
          <KpiCard
            label="High Signal Stories"
            value={loading ? '-' : highSignalStories}
            helper="Score 70 and above"
            icon={Flame}
            variant="progress"
            progress={loading ? undefined : highSignalRate}
            progressTone="warning"
            trend={
              loading
                ? undefined
                : {
                    value: highSignalRate >= 40 ? 'Strong trend velocity' : 'Monitor emerging trends',
                    direction: highSignalRate >= 40 ? 'up' : 'neutral',
                  }
            }
          />
          <KpiCard
            label="Last Snapshot"
            value={generatedAt ? new Date(generatedAt).toLocaleDateString() : 'Not available'}
            valueClassName="text-base"
            helper="Most recent refresh date"
            icon={CalendarClock}
            variant="compact"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trending Keywords</CardTitle>
            <CardDescription>
              {generatedAt
                ? `Last updated: ${new Date(generatedAt).toLocaleString()}`
                : 'No trend snapshot yet. Run refresh.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Button onClick={refreshNow} disabled={refreshing} className="mr-2">
                {refreshing ? 'Refreshing...' : 'Refresh Now'}
              </Button>
              <Button
                variant="outline"
                onClick={generateKeywordsFromTrend}
                disabled={generatingKeywords || !selectedKeyword}
              >
                {generatingKeywords ? 'Generating Keywords...' : 'Generate Keywords from Selected Trend'}
              </Button>
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {notice}
              </p>
            ) : null}

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant={selectedKeyword === keyword ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedKeyword(keyword)}
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No keywords available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Tech Stories</CardTitle>
            <CardDescription>Source-weighted + recency-weighted list from RSS feeds.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : items.length > 0 ? (
              <div className="space-y-4">
                {items.map((item) => (
                  <article key={item.id} className="rounded-lg border border-border bg-card/60 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{item.source}</Badge>
                      <span>Score {item.score}</span>
                      <span>
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : 'Publish time unavailable'}
                      </span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {item.title}
                    </a>
                    {item.summary ? (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tech stories found yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
