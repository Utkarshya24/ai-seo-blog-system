'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

interface Mention {
  id: string;
  provider: 'CHATGPT' | 'PERPLEXITY' | 'GEMINI' | 'CLAUDE' | 'OTHER';
  query: string;
  citedUrl: string;
  sourceUrl: string | null;
  rank: number | null;
  snippet: string | null;
  detectedAt: string;
}

interface Summary {
  totalMentions: number;
  citedMentions: number;
  citationRate: number;
  targetHost: string | null;
  providerBreakdown: Record<string, number>;
  topQueries: Array<{ query: string; count: number }>;
}

export default function VisibilityPage() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [provider, setProvider] = useState('CHATGPT');
  const [query, setQuery] = useState('');
  const [citedUrl, setCitedUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rank, setRank] = useState('');
  const [snippet, setSnippet] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [mentionsRes, summaryRes] = await Promise.all([
        tenantFetch('/api/ai-visibility/mentions?days=30'),
        tenantFetch('/api/ai-visibility/summary?days=30'),
      ]);

      const mentionsData = await mentionsRes.json();
      const summaryData = await summaryRes.json();

      if (!mentionsRes.ok) {
        setError(mentionsData.error || 'Failed to load mentions');
      } else {
        setMentions(mentionsData.mentions || []);
      }

      if (summaryRes.ok) {
        setSummary(summaryData);
      }
    } catch (loadError) {
      console.error('[Visibility] loadData error:', loadError);
      setError('Failed to load AI visibility data.');
    } finally {
      setLoading(false);
    }
  }

  async function ingestSampleMention(e: React.FormEvent) {
    e.preventDefault();
    setIngesting(true);
    setError('');
    setMessage('');

    try {
      const res = await tenantFetch('/api/ai-visibility/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentions: [
            {
              provider,
              query,
              citedUrl,
              sourceUrl: sourceUrl.trim() || undefined,
              rank: Number(rank || 0) || undefined,
              snippet: snippet.trim() || undefined,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to ingest mention');
        return;
      }

      setMessage(`Ingested ${data.ingested} mention.`);
      await loadData();
    } catch (ingestError) {
      console.error('[Visibility] ingest error:', ingestError);
      setError('Failed to ingest mention.');
    } finally {
      setIngesting(false);
    }
  }

  return (
    <AdminShell
      title="AI Visibility"
      description="Track ChatGPT/Perplexity citations and monitor mention share for your website."
    >
      <div className="grid gap-6">
        {summary ? (
          <Card>
            <CardHeader>
              <CardTitle>Provider Breakdown</CardTitle>
              <CardDescription>Mention distribution by assistant provider.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(summary.providerBreakdown || {}).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Visibility Summary (30 Days)</CardTitle>
            <CardDescription>Mentions and citation share for active website scope.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-8 w-8" />
              </div>
            ) : summary ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total Mentions</p>
                  <p className="text-2xl font-semibold">{summary.totalMentions}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Cited Mentions</p>
                  <p className="text-2xl font-semibold">{summary.citedMentions}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Citation Rate</p>
                  <p className="text-2xl font-semibold">{summary.citationRate}%</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Target Host</p>
                  <p className="text-sm font-medium">{summary.targetHost || 'Not resolved'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No summary available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingest Mention</CardTitle>
            <CardDescription>Use this form or API integration to record AI citations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={ingestSampleMention} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Provider</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={ingesting}
                >
                  <option value="CHATGPT">CHATGPT</option>
                  <option value="PERPLEXITY">PERPLEXITY</option>
                  <option value="GEMINI">GEMINI</option>
                  <option value="CLAUDE">CLAUDE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Query</label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} disabled={ingesting} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cited URL</label>
                <Input value={citedUrl} onChange={(e) => setCitedUrl(e.target.value)} disabled={ingesting} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Source URL (optional)</label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} disabled={ingesting} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Rank (optional)</label>
                <Input value={rank} onChange={(e) => setRank(e.target.value)} disabled={ingesting} />
              </div>
              <div className="xl:col-span-3">
                <label className="mb-1.5 block text-sm font-medium">Snippet (optional)</label>
                <Input value={snippet} onChange={(e) => setSnippet(e.target.value)} disabled={ingesting} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <Button type="submit" disabled={ingesting || !query.trim() || !citedUrl.trim()}>
                  {ingesting ? 'Saving...' : 'Ingest Mention'}
                </Button>
              </div>
            </form>

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Mentions</CardTitle>
            <CardDescription>Latest AI answers where URLs were cited.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : mentions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No mentions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Query</TableHead>
                      <TableHead>Cited URL</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mentions.map((mention) => (
                      <TableRow key={mention.id}>
                        <TableCell>{mention.provider}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{mention.query}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{mention.citedUrl}</TableCell>
                        <TableCell>{mention.rank ?? '-'}</TableCell>
                        <TableCell>{new Date(mention.detectedAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
