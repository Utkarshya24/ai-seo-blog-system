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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface Keyword {
  id: string;
  keyword: string;
  niche: string;
  status: string;
  searchVolume: number;
  createdAt: string;
}

export default function KeywordsManager() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [niche, setNiche] = useState('');
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function fetchKeywords() {
    setLoading(true);
    try {
      const res = await fetch('/api/keywords/generate');
      const data = await res.json();
      setKeywords(data.keywords || []);
    } catch (error) {
      console.error('[Keywords] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateKeywords(e: React.FormEvent) {
    e.preventDefault();
    if (!niche.trim()) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/keywords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, count }),
      });

      const data = await res.json();
      if (data.success) {
        setKeywords((prev) => [...data.keywords, ...prev]);
        setNiche('');
      } else {
        console.error('[Keywords] Generation failed:', data.error);
      }
    } catch (error) {
      console.error('[Keywords] Error generating:', error);
    } finally {
      setGenerating(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    used: 'bg-green-100 text-green-800',
    draft: 'bg-blue-100 text-blue-800',
  };

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
                Keywords Manager
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Generate Keywords Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Generate Keywords</CardTitle>
            <CardDescription>
              Use AI to generate SEO keywords for your niche
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={generateKeywords} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Niche
                  </label>
                  <Input
                    placeholder="e.g., AI tools, fitness, cooking"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    disabled={generating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Number of Keywords
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    disabled={generating}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={generating || !niche.trim()}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Generating...
                      </>
                    ) : (
                      'Generate Keywords'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Keywords Table */}
        <Card>
          <CardHeader>
            <CardTitle>Keywords List</CardTitle>
            <CardDescription>
              {keywords.length} keywords total
            </CardDescription>
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
                      <TableHead>Keyword</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Search Volume</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.map((keyword) => (
                      <TableRow key={keyword.id}>
                        <TableCell className="font-medium">
                          {keyword.keyword}
                        </TableCell>
                        <TableCell>{keyword.niche}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[keyword.status]}>
                            {keyword.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{keyword.searchVolume}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(keyword.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No keywords yet. Generate some to get started!
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
