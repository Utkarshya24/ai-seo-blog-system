'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Clock3, FileText, PenSquare } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tenantFetch } from '@/lib/client/tenant';
import { postStatusTones } from '@/lib/ui/status-maps';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  readingTime: number;
  publishedAt: string | null;
  createdAt: string;
  keyword: { id: string; keyword: string };
  seoAudit?: {
    score: number;
    suggestions: string[];
    scoreBreakdown?: {
      onPage: number;
      technical: number;
      readability: number;
      performance: number;
    };
  };
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
  const [linkingPostId, setLinkingPostId] = useState<string | null>(null);
  const [optimizingSeoPostId, setOptimizingSeoPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [savingEditor, setSavingEditor] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editMetaDescription, setEditMetaDescription] = useState('');
  const [editContent, setEditContent] = useState('');
  const [selectedKeywordId, setSelectedKeywordId] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const postId = new URLSearchParams(window.location.search).get('postId');
    if (postId) {
      void openEditor(postId);
    }
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

  async function autoInsertLinks(postId: string) {
    setError('');
    setMessage('');
    setLinkingPostId(postId);
    try {
      const res = await tenantFetch('/api/posts/auto-internal-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, maxLinks: 3 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to auto insert links.');
        return;
      }

      if (data.updated) {
        setMessage(`Inserted ${data.insertedLinks?.length || 0} internal links into selected post.`);
      } else {
        setMessage('No suitable internal link opportunity found for this post.');
      }
      await fetchData();
    } catch (linkError) {
      console.error('[Posts] autoInsertLinks error:', linkError);
      setError('Auto internal linking failed.');
    } finally {
      setLinkingPostId(null);
    }
  }

  async function updateSeo(postId: string) {
    setError('');
    setMessage('');
    setOptimizingSeoPostId(postId);
    try {
      const res = await tenantFetch('/api/posts/optimize-serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update SEO metadata.');
        return;
      }

      setMessage('SEO title/meta updated with optimization suggestions.');
      await fetchData();
    } catch (optimizeError) {
      console.error('[Posts] updateSeo error:', optimizeError);
      setError('Failed to update SEO metadata.');
    } finally {
      setOptimizingSeoPostId(null);
    }
  }

  async function openEditor(postId: string) {
    setError('');
    setMessage('');
    setLoadingEditor(true);
    try {
      const res = await tenantFetch(`/api/posts/${postId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load post editor.');
        return;
      }
      setEditingPostId(postId);
      setEditTitle(data.post?.title || '');
      setEditMetaDescription(data.post?.metaDescription || '');
      setEditContent(data.post?.content || '');
    } catch (editorError) {
      console.error('[Posts] openEditor error:', editorError);
      setError('Failed to load post editor.');
    } finally {
      setLoadingEditor(false);
    }
  }

  function closeEditor() {
    if (savingEditor) return;
    setEditingPostId(null);
    setEditTitle('');
    setEditMetaDescription('');
    setEditContent('');
  }

  async function saveEditor() {
    if (!editingPostId) return;
    setError('');
    setMessage('');
    setSavingEditor(true);
    try {
      const res = await tenantFetch(`/api/posts/${editingPostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          metaDescription: editMetaDescription,
          content: editContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save post changes.');
        return;
      }
      setMessage('Post updated successfully.');
      await fetchData();
    } catch (saveError) {
      console.error('[Posts] saveEditor error:', saveError);
      setError('Failed to save post changes.');
    } finally {
      setSavingEditor(false);
    }
  }

  const draftCount = posts.filter((post) => post.status === 'draft').length;
  const publishedCount = posts.filter((post) => post.status === 'published').length;
  const publishedRate = posts.length > 0 ? Math.round((publishedCount / posts.length) * 100) : 0;
  const draftRate = posts.length > 0 ? Math.round((draftCount / posts.length) * 100) : 0;
  const avgReadingTime =
    posts.length > 0
      ? Math.round(posts.reduce((sum, post) => sum + (post.readingTime || 0), 0) / posts.length)
      : 0;
  const avgSeoScore =
    posts.length > 0
      ? Math.round(posts.reduce((sum, post) => sum + (post.seoAudit?.score || 0), 0) / posts.length)
      : 0;

  return (
    <AdminShell
      title="Post Studio"
      description="Generate draft articles from keywords, review, and publish quickly."
    >
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Posts"
          value={loading ? '-' : posts.length}
          helper="Content inventory size"
          icon={FileText}
          trend={loading ? undefined : { value: `${publishedCount} published`, direction: 'up' }}
        />
        <KpiCard
          label="Draft Queue"
          value={loading ? '-' : draftCount}
          helper="Needs review and publish"
          icon={PenSquare}
          variant="progress"
          progress={loading ? undefined : draftRate}
          progressTone="warning"
          trend={
            loading
              ? undefined
              : {
                  value: draftRate > 40 ? 'Review queue high' : 'Queue in control',
                  direction: draftRate > 40 ? 'down' : 'up',
                }
          }
        />
        <KpiCard
          label="Published"
          value={loading ? '-' : publishedCount}
          helper="Live articles on blog"
          icon={BookOpenCheck}
          variant="progress"
          progress={loading ? undefined : publishedRate}
          progressTone="success"
          trend={loading ? undefined : { value: `${publishedRate}% publish ratio`, direction: 'up' }}
        />
        <KpiCard
          label="Avg Reading Time"
          value={loading ? '-' : `${avgReadingTime}m`}
          helper="Depth benchmark"
          icon={Clock3}
          variant="compact"
        />
        <KpiCard
          label="Avg SEO Score"
          value={loading ? '-' : avgSeoScore}
          helper="On-page + readability + GSC performance"
          icon={FileText}
          variant="compact"
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate New Post</CardTitle>
            <CardDescription>
              Select a pending keyword and create a draft. You can also push posts to an external webhook.
            </CardDescription>
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
                <Button
                  type="submit"
                  disabled={generating || !selectedKeywordId || !postTitle.trim()}
                  className="w-full"
                >
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
            {message ? (
              <p className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posts Library</CardTitle>
            <CardDescription>{posts.length} total posts</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : posts.length > 0 ? (
              <>
                <div className="space-y-3 lg:hidden">
                  {posts.map((post) => (
                    <div key={post.id} className="rounded-lg border border-border/70 bg-background/60 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <Link href={`/blog/${post.slug}`} className="line-clamp-2 text-sm font-semibold text-primary hover:underline">
                          {post.title}
                        </Link>
                        <StatusBadge label={post.status} tonesByLabel={postStatusTones} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Keyword: <span className="text-foreground">{post.keyword?.keyword}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SEO: <span className="text-foreground">{post.seoAudit?.score ?? 0}/100</span> | Read: <span className="text-foreground">{post.readingTime}m</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditor(post.id)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => updateSeo(post.id)} disabled={optimizingSeoPostId === post.id}>
                          {optimizingSeoPostId === post.id ? 'Updating...' : 'Update SEO'}
                        </Button>
                        {post.status === 'draft' ? (
                          <Button size="sm" variant="outline" onClick={() => publishPost(post.id)}>Publish</Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border/60 lg:block">
                <Table className="min-w-[1180px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SEO Score</TableHead>
                      <TableHead className="hidden lg:table-cell">SEO Suggestions</TableHead>
                      <TableHead className="hidden md:table-cell">Reading Time</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="max-w-[260px] align-top font-medium whitespace-normal break-words">
                          <Link href={`/blog/${post.slug}`} className="line-clamp-2 text-primary hover:underline">
                            {post.title}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[180px] align-top whitespace-normal break-words">{post.keyword?.keyword}</TableCell>
                        <TableCell className="align-top">
                          <StatusBadge label={post.status} tonesByLabel={postStatusTones} />
                        </TableCell>
                        <TableCell className="align-top">
                          <span
                            className={
                              post.seoAudit && post.seoAudit.score >= 80
                                ? 'font-semibold text-emerald-600'
                                : post.seoAudit && post.seoAudit.score >= 60
                                  ? 'font-semibold text-amber-600'
                                  : 'font-semibold text-rose-600'
                            }
                          >
                            {post.seoAudit?.score ?? 0}/100
                          </span>
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] align-top whitespace-normal break-words text-sm text-muted-foreground lg:table-cell">
                          {post.seoAudit?.suggestions?.slice(0, 2).join(' ') || 'Looks well optimized.'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">{post.readingTime} min</TableCell>
                        <TableCell className="hidden text-muted-foreground 2xl:table-cell">
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => autoInsertLinks(post.id)}
                              disabled={linkingPostId === post.id}
                            >
                              {linkingPostId === post.id ? 'Linking...' : 'Auto Internal Links'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateSeo(post.id)}
                              disabled={optimizingSeoPostId === post.id}
                            >
                              {optimizingSeoPostId === post.id ? 'Updating SEO...' : 'Update SEO'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditor(post.id)}
                              disabled={loadingEditor && editingPostId === post.id}
                            >
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No posts yet. Start by generating a draft.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editingPostId)} onOpenChange={(open) => (open ? undefined : closeEditor())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Blog Post</DialogTitle>
            <DialogDescription>Update title, meta description, and markdown content.</DialogDescription>
          </DialogHeader>

          {loadingEditor ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Meta Description</label>
                <Textarea
                  value={editMetaDescription}
                  onChange={(e) => setEditMetaDescription(e.target.value)}
                  className="min-h-[90px]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Content (Markdown)</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[320px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={savingEditor}>
              Close
            </Button>
            <Button
              onClick={saveEditor}
              disabled={savingEditor || loadingEditor || !editTitle.trim() || !editMetaDescription.trim() || !editContent.trim()}
            >
              {savingEditor ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
