'use client';

import { useCallback, useEffect, useState } from 'react';
import { Image, MessageSquareText, Newspaper, Share2 } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { KpiCard } from '@/components/admin-kpi-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [socialImageUrl, setSocialImageUrl] = useState('');
  const [generatingImage, setGeneratingImage] = useState<'banner' | 'social' | null>(null);
  const [customImagePrompt, setCustomImagePrompt] = useState('');

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

  async function generateImage(variant: 'banner' | 'social') {
    if (!selectedPostId) return;
    setGeneratingImage(variant);
    setError('');
    setMessage('');
    try {
      const res = await tenantFetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPostId,
          variant,
          prompt: customImagePrompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate image');
        return;
      }

      const imageUrl = (data.images?.[0] as string | undefined) || '';
      if (!imageUrl) {
        setError('No image URL returned from generator.');
        return;
      }

      if (variant === 'banner') {
        setBannerImageUrl(imageUrl);
      } else {
        setSocialImageUrl(imageUrl);
      }
      setMessage(`${variant === 'banner' ? 'Banner' : 'Social'} image generated.`);
    } catch (imageError) {
      console.error('[Social] generateImage error:', imageError);
      setError('Failed to generate image.');
    } finally {
      setGeneratingImage(null);
    }
  }

  useEffect(() => {
    void loadDrafts(selectedPostId);
  }, [selectedPostId, loadDrafts]);

  const latestLinkedin = drafts.find((d) => d.platform === 'LINKEDIN');
  const latestX = drafts.find((d) => d.platform === 'X');
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const channelCoverage = (latestLinkedin ? 1 : 0) + (latestX ? 1 : 0);
  const channelCoveragePercent = Math.round((channelCoverage / 2) * 100);
  const imageGeneratedCount = (bannerImageUrl ? 1 : 0) + (socialImageUrl ? 1 : 0);

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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Published Posts"
            value={loading ? '-' : posts.length}
            helper="Eligible for social generation"
            icon={Newspaper}
            trend={loading ? undefined : { value: `${selectedPost ? '1' : '0'} post selected`, direction: 'neutral' }}
          />
          <KpiCard
            label="Total Drafts"
            value={drafts.length}
            helper="For selected post"
            icon={MessageSquareText}
            variant="compact"
            trend={
              loading
                ? undefined
                : {
                    value: drafts.length > 0 ? 'Draft set available' : 'No drafts yet',
                    direction: drafts.length > 0 ? 'up' : 'neutral',
                  }
            }
          />
          <KpiCard
            label="LinkedIn / X"
            value={`${latestLinkedin ? 1 : 0}/${latestX ? 1 : 0}`}
            helper="Latest channel coverage"
            icon={Share2}
            variant="progress"
            progress={loading ? undefined : channelCoveragePercent}
            progressTone="success"
            trend={
              loading
                ? undefined
                : {
                    value: channelCoveragePercent === 100 ? 'Both channels ready' : 'Missing one channel',
                    direction: channelCoveragePercent === 100 ? 'up' : 'down',
                  }
            }
          />
          <KpiCard
            label="Current Post"
            value={selectedPost?.title || 'No post selected'}
            valueClassName="line-clamp-1 text-base"
            helper="Active generation context"
            icon={Image}
            variant="compact"
            trend={
              loading
                ? undefined
                : {
                    value: `${imageGeneratedCount}/2 images generated`,
                    direction: imageGeneratedCount > 0 ? 'up' : 'neutral',
                  }
            }
          />
        </div>

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
              <>
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

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Custom Image Prompt (optional)</label>
                    <Input
                      value={customImagePrompt}
                      onChange={(e) => setCustomImagePrompt(e.target.value)}
                      placeholder="e.g., modern local SEO dashboard visual, clean blue gradients, no text"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void generateImage('banner')}
                    disabled={generatingImage !== null || !selectedPostId}
                  >
                    {generatingImage === 'banner' ? 'Generating Banner...' : 'Generate Banner Image'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void generateImage('social')}
                    disabled={generatingImage !== null || !selectedPostId}
                  >
                    {generatingImage === 'social' ? 'Generating Social...' : 'Generate Social Image'}
                  </Button>
                </div>
              </>
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
              <CardTitle>Blog Banner Image</CardTitle>
              <CardDescription>Generated from selected post via Gemini image model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bannerImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bannerImageUrl} alt="Generated blog banner" className="w-full rounded-md border border-border" />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => copyText(bannerImageUrl)}>
                      Copy Banner URL
                    </Button>
                    <Button variant="outline" onClick={() => window.open(bannerImageUrl, '_blank', 'noopener,noreferrer')}>
                      Open
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No banner image generated yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Post Image</CardTitle>
              <CardDescription>Square asset for LinkedIn/X posts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {socialImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={socialImageUrl} alt="Generated social post visual" className="w-full rounded-md border border-border" />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => copyText(socialImageUrl)}>
                      Copy Social URL
                    </Button>
                    <Button variant="outline" onClick={() => window.open(socialImageUrl, '_blank', 'noopener,noreferrer')}>
                      Open
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No social image generated yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

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
