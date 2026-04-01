'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  readingTime: number;
  publishedAt: string | null;
  createdAt: string;
  keyword: { id: string; keyword: string };
}

interface KeywordOption {
  id: string;
  keyword: string;
  status: string;
}

export default function PostsManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushingExternalId, setPushingExternalId] = useState<string | null>(null);
  const [selectedKeywordId, setSelectedKeywordId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [postsRes, keywordsRes] = await Promise.all([
        tenantFetch('/api/posts/generate'),
        tenantFetch('/api/keywords/generate'),
      ]);

      const postsData = await postsRes.json();
      const keywordsData = await keywordsRes.json();

      setPosts(postsData.posts || []);
      setKeywords((keywordsData.keywords || []).filter((k: KeywordOption) => k.status === 'pending'));
    } catch (fetchError) {
      console.error('[Posts] Error fetching:', fetchError);
      setError('Unable to load posts/keywords.');
    } finally {
      setLoading(false);
    }
  }

  async function generateBlogPost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedKeywordId || !postTitle.trim()) return;

    setGenerating(true);
    setError('');
    try {
      const res = await tenantFetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywordId: selectedKeywordId,
          title: postTitle,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts((prev) => [data.post, ...prev]);
        setPostTitle('');
        setSelectedKeywordId('');
        await fetchData();
      } else {
        setError(data.error || 'Post generation failed.');
        console.error('[Posts] Generation failed:', data.error);
      }
    } catch (generateError) {
      console.error('[Posts] Error generating:', generateError);
      setError('Unable to generate post right now.');
    } finally {
      setGenerating(false);
    }
  }

  async function publishPost(postId: string) {
    setError('');
    try {
      const res = await tenantFetch('/api/posts/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, status: 'published', publishedAt: new Date().toISOString() }
              : post
          )
        );
      } else {
        setError(data.error || 'Failed to publish post.');
      }
    } catch (publishError) {
      console.error('[Posts] Error publishing:', publishError);
      setError('Failed to publish post.');
    }
  }

  async function pushPostExternally(postId: string) {
    setError('');
    setPushingExternalId(postId);
    try {
      const res = await tenantFetch('/api/posts/publish-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          webhookUrl: webhookUrl.trim() || undefined,
          publishIfDraft: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.post) {
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    status: data.post.status,
                    publishedAt: data.post.publishedAt,
                  }
                : post
            )
          );
        }
      } else {
        setError(data.error || 'External publish failed.');
      }
    } catch (pushError) {
      console.error('[Posts] Error publishing externally:', pushError);
      setError('External publish failed.');
    } finally {
      setPushingExternalId(null);
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-sky-100 text-sky-800',
    published: 'bg-emerald-100 text-emerald-800',
    scheduled: 'bg-violet-100 text-violet-800',
  };

  return (
    <AdminShell
      title="Post Studio"
      description="Generate draft articles from keywords, review, and publish quickly."
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Post</CardTitle>
            <CardDescription>Select a pending keyword and create a draft. You can also push posts to an external webhook.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={generateBlogPost} className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Select Keyword</label>
                <select
                  value={selectedKeywordId}
                  onChange={(e) => setSelectedKeywordId(e.target.value)}
                  disabled={generating}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">Choose a keyword...</option>
                  {keywords.map((keyword) => (
                    <option key={keyword.id} value={keyword.id}>
                      {keyword.keyword}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Post Title</label>
                <Input
                  placeholder="Enter article title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  disabled={generating}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={generating || !selectedKeywordId || !postTitle.trim()} className="w-full">
                  {generating ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Generating
                    </>
                  ) : (
                    'Generate Draft'
                  )}
                </Button>
              </div>
            </form>
            <div className="mt-4 grid gap-2 md:max-w-xl">
              <label className="text-sm font-medium">External Webhook URL (optional override)</label>
              <Input
                placeholder="https://your-main-site.com/api/content-ingest"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use server env `EXTERNAL_PUBLISH_WEBHOOK_URL`.
              </p>
            </div>
            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posts Library</CardTitle>
            <CardDescription>{posts.length} total posts</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : posts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reading Time</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="max-w-xs font-medium">
                          <Link href={`/blog/${post.slug}`} className="line-clamp-1 text-primary hover:underline">
                            {post.title}
                          </Link>
                        </TableCell>
                        <TableCell>{post.keyword?.keyword}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[post.status] || 'bg-secondary text-foreground'}>
                            {post.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{post.readingTime} min</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {post.status === 'draft' ? (
                              <Button size="sm" variant="outline" onClick={() => publishPost(post.id)}>
                                Publish
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              onClick={() => pushPostExternally(post.id)}
                              disabled={pushingExternalId === post.id}
                            >
                              {pushingExternalId === post.id ? (
                                <>
                                  <Spinner className="mr-2 h-3.5 w-3.5" />
                                  Pushing
                                </>
                              ) : (
                                'Push External'
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No posts yet. Start by generating a draft.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
