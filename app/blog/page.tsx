'use cache';

import { prisma } from '@/lib/db';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/seo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog | AI SEO Blog System',
  description: 'Read our latest SEO-optimized blog posts powered by AI',
};

async function getPosts() {
  try {
    const posts = await prisma.post.findMany({
      where: {
        status: 'published',
      },
      include: {
        keyword: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    return posts;
  } catch (error) {
    console.error('[Blog] Error fetching posts:', error);
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            AI-Powered Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Discover SEO-optimized articles created with AI
          </p>
        </div>

        {/* Blog Posts Grid */}
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
              >
                <h2 className="mb-2 text-xl font-bold text-foreground group-hover:text-primary">
                  {post.title}
                </h2>

                <p className="mb-4 flex-grow text-sm text-muted-foreground line-clamp-2">
                  {post.metaDescription}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{post.readingTime} min read</span>
                  <span>{formatDate(new Date(post.publishedAt!))}</span>
                </div>

                {post.keyword && (
                  <div className="mt-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {post.keyword.keyword}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center">
            <p className="text-muted-foreground">No published posts yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
