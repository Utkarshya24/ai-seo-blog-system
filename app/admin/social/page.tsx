'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

interface PostOption {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface SocialDraft {
  id: string;
  platform: 'LINKEDIN' | 'X';
  content: string;
  hashtags: string | null;
  callToAction: string | null;
  createdAt: string;
}

export default function SocialPage() {
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [drafts, setDrafts] = useState<SocialDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await tenantFetch('/api/posts/generate?status=published');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load posts');
        return;
      }

      const rows: PostOption[] = data.posts || [];
      setPosts(rows);
      setSelectedPostId((current) => current || rows[0]?.id || '');
    } catch (loadError) {
      console.error('[Social] loadPosts error:', loadError);
      setError('Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(async (postId: string) => {
    if (!postId) {
      setDrafts([]);
      return;
    }
    const res = await tenantFetch(`/api/social/generate?postId=${encodeURIComponent(postId)}`);
    const data = await res.json();
    if (res.ok) {
      setDrafts(data.drafts || []);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function generateDrafts() {
    if (!selectedPostId) return;
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const res = await tenantFetch('/api/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: selectedPostId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate social drafts');
        return;
      }

      setMessage('LinkedIn + X drafts generated successfully.');
      await loadDrafts(selectedPostId);
    } catch (generateError) {
      console.error('[Social] generateDrafts error:', generateError);
      setError('Failed to generate social drafts.');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    void loadDrafts(selectedPostId);
  }, [selectedPostId, loadDrafts]);

  const latestLinkedin = drafts.find((d) => d.platform === 'LINKEDIN');
  const latestX = drafts.find((d) => d.platform === 'X');

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Copied to clipboard.');
    } catch {
      setMessage('Unable to copy automatically.');
    }
  }

  return (
    <AdminShell
      title="Social SEO Generator"
      description="Generate LinkedIn and Twitter(X) promotional posts from your published SEO blogs."
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Social Drafts</CardTitle>
            <CardDescription>Select a published blog post and generate platform-specific social copy.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium">Published Post</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(e.target.value)}
                  >
                    {posts.length === 0 ? <option value="">No published posts</option> : null}
                    {posts.map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={generateDrafts} disabled={generating || !selectedPostId}>
                    {generating ? 'Generating...' : 'Generate LinkedIn + X'}
                  </Button>
                </div>
              </div>
            )}

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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn Draft</CardTitle>
              <CardDescription>Long-form professional post optimized for discoverability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestLinkedin ? (
                <>
                  <textarea
                    className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 text-sm"
                    value={`${latestLinkedin.content}\n\n${latestLinkedin.hashtags || ''}\n${latestLinkedin.callToAction || ''}`.trim()}
                    readOnly
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      copyText(
                        `${latestLinkedin.content}\n\n${latestLinkedin.hashtags || ''}\n${latestLinkedin.callToAction || ''}`.trim()
                      )
                    }
                  >
                    Copy LinkedIn Draft
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No LinkedIn draft yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Twitter (X) Draft</CardTitle>
              <CardDescription>Short SEO-focused post with concise hook and CTA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestX ? (
                <>
                  <textarea
                    className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 text-sm"
                    value={`${latestX.content}\n\n${latestX.hashtags || ''}\n${latestX.callToAction || ''}`.trim()}
                    readOnly
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      copyText(`${latestX.content}\n\n${latestX.hashtags || ''}\n${latestX.callToAction || ''}`.trim())
                    }
                  >
                    Copy X Draft
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No X draft yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Social Drafts</CardTitle>
            <CardDescription>Latest generated platform drafts for selected post.</CardDescription>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No drafts found for selected post.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((draft) => (
                      <TableRow key={draft.id}>
                        <TableCell>{draft.platform}</TableCell>
                        <TableCell className="max-w-[520px] truncate">{draft.content}</TableCell>
                        <TableCell>{new Date(draft.createdAt).toLocaleString()}</TableCell>
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
