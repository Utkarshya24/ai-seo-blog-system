'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

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
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function KeywordsManager() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState('');
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<'mixed' | 'standard' | 'comparison'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function fetchKeywords() {
    setLoading(true);
    setError('');
    try {
      const res = await tenantFetch('/api/keywords/generate');
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch (fetchError) {
      console.error('[Keywords] Error fetching:', fetchError);
      setError('Unable to load keywords right now.');
    } finally {
      setLoading(false);
    }
  }

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
        setKeywords((prev) => [...data.keywords, ...prev]);
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

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    used: 'bg-emerald-100 text-emerald-800',
    draft: 'bg-sky-100 text-sky-800',
  };

  return (
    <AdminShell
      title="Keyword Intelligence"
      description="Generate and maintain a prioritized SEO keyword backlog."
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Keywords</CardTitle>
            <CardDescription>Provide a niche and let AI suggest keyword ideas.</CardDescription>
          </CardHeader>
          <CardContent>
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
            <CardDescription>{keywords.length} records tracked</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : keywords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {keyword.id}
                        </TableCell>
                        <TableCell className="font-medium">{keyword.keyword}</TableCell>
                        <TableCell>{keyword.niche}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[keyword.status] || 'bg-secondary text-foreground'}>
                            {keyword.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{keyword.intent || 'informational'}</TableCell>
                        <TableCell>{(keyword.priorityScore ?? 0).toFixed(1)}</TableCell>
                        <TableCell>{keyword.difficulty}</TableCell>
                        <TableCell>
                          <div className="font-medium">{keyword.searchVolume}</div>
                          <div className="text-xs text-muted-foreground">
                            {keyword.searchVolumeSource === 'gsc'
                              ? `GSC ${keyword.searchVolumeStartDate || ''} to ${keyword.searchVolumeEndDate || ''}`
                              : 'Estimated'}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(keyword.generatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(keyword.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(keyword.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No keywords yet. Generate your first batch.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
