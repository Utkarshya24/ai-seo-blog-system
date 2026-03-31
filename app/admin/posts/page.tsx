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

export default function PostsManager() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedKeywordId, setSelectedKeywordId] = useState('');
  const [postTitle, setPostTitle] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [postsRes, keywordsRes] = await Promise.all([
        fetch('/api/posts/generate'),
        fetch('/api/keywords/generate'),
      ]);

      const postsData = await postsRes.json();
      const keywordsData = await keywordsRes.json();

      setPosts(postsData.posts || []);
      setKeywords(keywordsData.keywords?.filter((k: any) => k.status === 'pending') || []);
    } catch (error) {
      console.error('[Posts] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateBlogPost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedKeywordId || !postTitle.trim()) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/posts/generate', {
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
        await fetchData(); // Refresh data
      } else {
        console.error('[Posts] Generation failed:', data.error);
      }
    } catch (error) {
      console.error('[Posts] Error generating:', error);
    } finally {
      setGenerating(false);
    }
  }

  async function publishPost(postId: string) {
    try {
      const res = await fetch('/api/posts/publish', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, status: 'published', publishedAt: new Date().toISOString() }
              : p
          )
        );
      }
    } catch (error) {
      console.error('[Posts] Error publishing:', error);
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800',
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
                Posts Manager
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Generate Blog Post Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Generate New Blog Post</CardTitle>
            <CardDescription>
              Create a new blog post from an existing keyword
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={generateBlogPost} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Select Keyword
                  </label>
                  <select
                    value={selectedKeywordId}
                    onChange={(e) => setSelectedKeywordId(e.target.value)}
                    disabled={generating}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="">Choose a keyword...</option>
                    {keywords.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.keyword}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Post Title
                  </label>
                  <Input
                    placeholder="Enter post title"
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
                        Generating...
                      </>
                    ) : (
                      'Generate Post'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Posts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Blog Posts</CardTitle>
            <CardDescription>
              {posts.length} posts total
            </CardDescription>
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
                        <TableCell className="font-medium max-w-xs truncate">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="text-primary hover:underline"
                          >
                            {post.title}
                          </Link>
                        </TableCell>
                        <TableCell>{post.keyword?.keyword}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[post.status]}>
                            {post.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{post.readingTime} min</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {post.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishPost(post.id)}
                            >
                              Publish
                            </Button>
                          )}
                          {post.status === 'published' && (
                            <span className="text-xs text-muted-foreground">
                              Published
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No posts yet. Generate some to get started!
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
