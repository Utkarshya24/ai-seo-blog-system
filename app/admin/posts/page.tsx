'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Check, ChevronsUpDown, Clock3, FileText, PenSquare } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStoredWebsiteId, tenantFetch } from '@/lib/client/tenant';
import { postStatusTones, type StatusTone } from '@/lib/ui/status-maps';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  externalPushed: boolean;
  externalPushedAt: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  readingTime: number;
  publishedAt: string | null;
  createdAt: string;
  keyword: { id: string; keyword: string };
  seoAudit?: {
    score: number;
    suggestions: string[];
    metricsUsed?: {
      pageSpeedPerformanceScore?: number;
    };
    scoreBreakdown?: {
      onPage: number;
      technical: number;
      readability: number;
      performance: number;
    };
  };
}

const pageSpeedStatusTones: Record<string, StatusTone> = {
  Good: 'success',
  'Needs Work': 'warning',
  Poor: 'danger',
  Unavailable: 'neutral',
};

const externalPushStatusTones: Record<string, StatusTone> = {
  Pushed: 'success',
  Draft: 'neutral',
};

function getPageSpeedStatus(score?: number) {
  if (!score || score <= 0) return 'Unavailable';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

function getExternalPushStatus(post: Post) {
  return post.externalPushed ? 'Pushed' : 'Draft';
}

interface KeywordOption {
  id: string;
  keyword: string;
  status: string;
}

interface KeywordPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface WebsiteDetails {
  id: string;
  externalWebhookUrl?: string | null;
}

function isBusy(postId: string, params: {
  pushingExternalId: string | null;
  linkingPostId: string | null;
  optimizingSeoPostId: string | null;
  loadingEditor: boolean;
  editingPostId: string | null;
}) {
  return (
    params.pushingExternalId === postId ||
    params.linkingPostId === postId ||
    params.optimizingSeoPostId === postId ||
    (params.loadingEditor && params.editingPostId === postId)
  );
}

export default function PostsManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [keywords, setKeywords] = useState<KeywordOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKeywordOptions, setLoadingKeywordOptions] = useState(false);
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
  const [editCoverImageUrl, setEditCoverImageUrl] = useState('');
  const [editCoverImageAlt, setEditCoverImageAlt] = useState('');
  const [editCoverImageFile, setEditCoverImageFile] = useState<File | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);
  const [selectedKeywordId, setSelectedKeywordId] = useState('');
  const [selectedKeywordLabel, setSelectedKeywordLabel] = useState('');
  const [keywordPickerOpen, setKeywordPickerOpen] = useState(false);
  const [keywordSearchQuery, setKeywordSearchQuery] = useState('');
  const [debouncedKeywordQuery, setDebouncedKeywordQuery] = useState('');
  const [keywordPage, setKeywordPage] = useState(1);
  const [keywordPagination, setKeywordPagination] = useState<KeywordPaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [postTitle, setPostTitle] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [activeWebsiteId, setActiveWebsiteId] = useState('');
  const [savingWebhookUrl, setSavingWebhookUrl] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchKeywordOptions = useCallback(async (pageToLoad: number, query: string) => {
    setLoadingKeywordOptions(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageToLoad));
      params.set('limit', '20');
      params.set('status', 'pending');
      if (query.trim()) params.set('q', query.trim());

      const res = await tenantFetch(`/api/keywords/search?${params.toString()}`);
      const data = await res.json();
      setKeywords(data.keywords || []);
      if (data.pagination) {
        setKeywordPagination(data.pagination);
      } else {
        setKeywordPagination({ page: pageToLoad, limit: 20, total: 0, totalPages: 1 });
      }
    } catch (keywordError) {
      console.error('[Posts] Error fetching keyword options:', keywordError);
      setError('Unable to load keywords.');
    } finally {
      setLoadingKeywordOptions(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeywordQuery(keywordSearchQuery);
      setKeywordPage(1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [keywordSearchQuery]);

  useEffect(() => {
    void fetchKeywordOptions(keywordPage, debouncedKeywordQuery);
  }, [debouncedKeywordQuery, fetchKeywordOptions, keywordPage]);

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    const syncWebsiteId = () => {
      const websiteId = getStoredWebsiteId() || '';
      setActiveWebsiteId((prev) => (prev === websiteId ? prev : websiteId));
    };

    syncWebsiteId();
    const interval = setInterval(syncWebsiteId, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeWebsiteId) {
      setWebhookUrl('');
      return;
    }
    void loadWebsiteWebhook(activeWebsiteId);
  }, [activeWebsiteId]);

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
      const postsRes = await tenantFetch('/api/posts/generate');
      const postsData = await postsRes.json();
      if (!postsRes.ok) {
        throw new Error(postsData.error || 'Unable to load posts.');
      }
      setPosts(Array.isArray(postsData.posts) ? postsData.posts : []);
    } catch (fetchError) {
      console.error('[Posts] Error fetching:', fetchError);
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load posts.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWebsiteWebhook(websiteId: string) {
    try {
      const res = await tenantFetch(`/api/websites/${websiteId}`);
      const data = await res.json();
      if (!res.ok) return;
      const website = data.website as WebsiteDetails | undefined;
      setWebhookUrl(website?.externalWebhookUrl || '');
    } catch (loadWebhookError) {
      console.error('[Posts] Error loading website webhook:', loadWebhookError);
    }
  }

  async function saveWebsiteWebhook() {
    if (!activeWebsiteId) {
      setError('Select a website first from workspace controls.');
      return;
    }
    setSavingWebhookUrl(true);
    setError('');
    setMessage('');
    try {
      const res = await tenantFetch(`/api/websites/${activeWebsiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalWebhookUrl: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save webhook URL.');
        return;
      }
      setMessage('Webhook URL saved for this website.');
    } catch (saveWebhookError) {
      console.error('[Posts] Error saving website webhook:', saveWebhookError);
      setError('Failed to save webhook URL.');
    } finally {
      setSavingWebhookUrl(false);
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
        setSelectedKeywordLabel('');
        await Promise.all([
          fetchData(),
          fetchKeywordOptions(keywordPage, debouncedKeywordQuery),
        ]);
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
                    externalPushed: Boolean(data.post.externalPushed),
                    externalPushedAt: data.post.externalPushedAt || null,
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
      setEditCoverImageUrl(data.post?.coverImageUrl || '');
      setEditCoverImageAlt(data.post?.coverImageAlt || '');
      setEditCoverImageFile(null);
      setRemoveCoverImage(false);
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
    setEditCoverImageUrl('');
    setEditCoverImageAlt('');
    setEditCoverImageFile(null);
    setRemoveCoverImage(false);
  }

  async function saveEditor() {
    if (!editingPostId) return;
    setError('');
    setMessage('');
    setSavingEditor(true);
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('metaDescription', editMetaDescription);
      formData.append('content', editContent);
      formData.append('coverImageAlt', editCoverImageAlt);
      formData.append('removeCoverImage', String(removeCoverImage));
      if (editCoverImageFile) {
        formData.append('coverImage', editCoverImageFile);
      }

      const res = await tenantFetch(`/api/posts/${editingPostId}`, {
        method: 'PATCH',
        body: formData,
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
                <Popover open={keywordPickerOpen} onOpenChange={setKeywordPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={keywordPickerOpen}
                      className="w-full justify-between"
                      disabled={generating || loadingKeywordOptions}
                    >
                      <span className="truncate">
                        {selectedKeywordId ? selectedKeywordLabel || 'Selected keyword' : 'Search and select keyword...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[430px] p-0">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Type keyword to search..."
                        value={keywordSearchQuery}
                        onValueChange={setKeywordSearchQuery}
                      />
                      <CommandList>
                        {loadingKeywordOptions ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                            <Spinner className="h-4 w-4" />
                            Searching keywords...
                          </div>
                        ) : null}
                        <CommandEmpty>No matching keywords found.</CommandEmpty>
                        <CommandGroup heading="Pending Keywords">
                          {selectedKeywordId && !keywords.some((keyword) => keyword.id === selectedKeywordId) ? (
                            <CommandItem
                              value={selectedKeywordLabel || 'selected-keyword'}
                              onSelect={() => {
                                setKeywordPickerOpen(false);
                              }}
                            >
                              <Check className="h-4 w-4" />
                              <span className="truncate">{selectedKeywordLabel || 'Selected keyword'}</span>
                            </CommandItem>
                          ) : null}
                          {keywords.map((keyword) => (
                            <CommandItem
                              key={keyword.id}
                              value={keyword.keyword}
                              onSelect={() => {
                                setSelectedKeywordId(keyword.id);
                                setSelectedKeywordLabel(keyword.keyword);
                                setKeywordPickerOpen(false);
                              }}
                            >
                              <Check className={`h-4 w-4 ${selectedKeywordId === keyword.id ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="truncate">{keyword.keyword}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <div className="border-t px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{`${keywordPagination.total} matching keywords`}</span>
                        <span>{`Page ${keywordPagination.page} of ${keywordPagination.totalPages}`}</span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loadingKeywordOptions || keywordPage <= 1}
                          onClick={() => setKeywordPage((prev) => Math.max(1, prev - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={loadingKeywordOptions || keywordPage >= keywordPagination.totalPages}
                          onClick={() => setKeywordPage((prev) => Math.min(keywordPagination.totalPages, prev + 1))}
                        >
                          Next
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Suggestions refresh 2 seconds after typing stops.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
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
              <div className="flex gap-2">
                <Input
                  placeholder="https://your-main-site.com/api/content-ingest"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveWebsiteWebhook}
                  disabled={savingWebhookUrl || !activeWebsiteId}
                >
                  {savingWebhookUrl ? 'Saving...' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saved per website. Leave empty to use server env `EXTERNAL_PUBLISH_WEBHOOK_URL`.
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
                      <p className="text-xs text-muted-foreground">
                        External: <span className="text-foreground">{getExternalPushStatus(post)}</span>
                        {' '}| Last Push:{' '}
                        <span className="text-foreground">{post.externalPushedAt ? new Date(post.externalPushedAt).toLocaleString() : '-'}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">PageSpeed:</span>
                        <StatusBadge
                          label={getPageSpeedStatus(post.seoAudit?.metricsUsed?.pageSpeedPerformanceScore)}
                          tonesByLabel={pageSpeedStatusTones}
                        />
                        <span className="text-xs text-muted-foreground">
                          {post.seoAudit?.metricsUsed?.pageSpeedPerformanceScore || 0}/100
                        </span>
                      </div>
                      <div className="mt-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">Actions</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem
                              disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                              onSelect={() => openEditor(post.id)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                              onSelect={() => updateSeo(post.id)}
                            >
                              {optimizingSeoPostId === post.id ? 'Updating SEO...' : 'Update SEO'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                              onSelect={() => autoInsertLinks(post.id)}
                            >
                              {linkingPostId === post.id ? 'Linking...' : 'Auto Internal Links'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                              onSelect={() => pushPostExternally(post.id)}
                            >
                              {pushingExternalId === post.id ? 'Pushing...' : 'Push External'}
                            </DropdownMenuItem>
                            {post.status === 'draft' ? (
                              <DropdownMenuItem
                                disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                onSelect={() => publishPost(post.id)}
                              >
                                Publish
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden max-w-full overflow-x-auto rounded-lg border border-border/60 lg:block">
                <Table className="min-w-[1460px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>External Push</TableHead>
                      <TableHead className="hidden xl:table-cell">Last Pushed At</TableHead>
                      <TableHead>SEO Score</TableHead>
                      <TableHead>PageSpeed</TableHead>
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
                          <StatusBadge
                            label={getExternalPushStatus(post)}
                            tonesByLabel={externalPushStatusTones}
                          />
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground xl:table-cell">
                          {post.externalPushedAt ? new Date(post.externalPushedAt).toLocaleString() : '-'}
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
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-1">
                            <StatusBadge
                              label={getPageSpeedStatus(post.seoAudit?.metricsUsed?.pageSpeedPerformanceScore)}
                              tonesByLabel={pageSpeedStatusTones}
                            />
                            <span className="text-xs text-muted-foreground">
                              {post.seoAudit?.metricsUsed?.pageSpeedPerformanceScore || 0}/100
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[280px] align-top whitespace-normal break-words text-sm text-muted-foreground lg:table-cell">
                          {post.seoAudit?.suggestions?.slice(0, 2).join(' ') || 'Looks well optimized.'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">{post.readingTime} min</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {new Date(post.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                onSelect={() => openEditor(post.id)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                onSelect={() => updateSeo(post.id)}
                              >
                                {optimizingSeoPostId === post.id ? 'Updating SEO...' : 'Update SEO'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                onSelect={() => autoInsertLinks(post.id)}
                              >
                                {linkingPostId === post.id ? 'Linking...' : 'Auto Internal Links'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                onSelect={() => pushPostExternally(post.id)}
                              >
                                {pushingExternalId === post.id ? 'Pushing...' : 'Push External'}
                              </DropdownMenuItem>
                              {post.status === 'draft' ? (
                                <DropdownMenuItem
                                  disabled={isBusy(post.id, { pushingExternalId, linkingPostId, optimizingSeoPostId, loadingEditor, editingPostId })}
                                  onSelect={() => publishPost(post.id)}
                                >
                                  Publish
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cover Image (optional)</label>
                {editCoverImageUrl && !removeCoverImage ? (
                  <div className="mb-3 overflow-hidden rounded-md border border-border">
                    <img src={editCoverImageUrl} alt={editCoverImageAlt || editTitle || 'Cover image'} className="h-48 w-full object-cover" />
                  </div>
                ) : null}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditCoverImageFile(file);
                    if (file) {
                      setRemoveCoverImage(false);
                    }
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploading a new file replaces the current image.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cover Image Alt Text</label>
                <Input
                  value={editCoverImageAlt}
                  onChange={(e) => setEditCoverImageAlt(e.target.value)}
                  placeholder="Short descriptive alt text"
                />
              </div>
              {(editCoverImageUrl || editCoverImageFile) ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={removeCoverImage}
                    onChange={(e) => setRemoveCoverImage(e.target.checked)}
                  />
                  Remove current cover image
                </label>
              ) : null}
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
