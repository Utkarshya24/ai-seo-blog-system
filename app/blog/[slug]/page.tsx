import { prisma } from '@/lib/db';
import { formatDate, generateTableOfContents } from '@/lib/utils/seo';
import { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function getPost(slug: string) {
  try {
    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        keyword: true,
      },
    });

    return post;
  } catch (error) {
    console.error('[Blog] Error fetching post:', error);
    return null;
  }
}

export async function generateMetadata(
  { params }: BlogPostPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post.title,
    description: post.metaDescription,
    keywords: post.keyword ? [post.keyword.keyword] : [],
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const toc = generateTableOfContents(post.content);

  return (
    <main className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="border-b border-border bg-secondary/50">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/blog"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>

      {/* Article Container */}
      <article className="container mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt?.toISOString()}>
              {formatDate(new Date(post.publishedAt!))}
            </time>
            <span>•</span>
            <span>{post.readingTime} min read</span>

            {post.keyword && (
              <>
                <span>•</span>
                <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {post.keyword.keyword}
                </span>
              </>
            )}
          </div>

          <p className="mt-4 text-lg text-muted-foreground">
            {post.metaDescription}
          </p>
        </header>

        {/* Table of Contents */}
        {toc.length > 0 && (
          <div className="mb-12 rounded-lg border border-border bg-secondary/50 p-6">
            <h2 className="mb-4 font-bold text-foreground">Table of Contents</h2>
            <ul className="space-y-2">
              {toc.map((item) => (
                <li key={item.id} style={{ marginLeft: `${(item.level - 2) * 1.5}rem` }}>
                  <a
                    href={`#${item.id}`}
                    className="text-primary hover:underline"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Content */}
        <div className="prose prose-sm max-w-none space-y-6 text-foreground dark:prose-invert">
          {post.content.split('\n\n').map((paragraph, idx) => {
            // Check if it's a heading
            if (paragraph.startsWith('#')) {
              const level = paragraph.match(/^#+/)?.[0].length || 2;
              const text = paragraph.replace(/^#+\s/, '');
              const id = text.toLowerCase().replace(/\s+/g, '-');

              const headingClass =
                level === 2
                  ? 'text-2xl font-bold'
                  : level === 3
                    ? 'text-xl font-bold'
                    : 'text-lg font-bold';

              return (
                <h2 key={idx} id={id} className={headingClass}>
                  {text}
                </h2>
              );
            }

            // Regular paragraph
            if (paragraph.trim()) {
              return <p key={idx}>{paragraph}</p>;
            }

            return null;
          })}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">
            Published on {formatDate(new Date(post.publishedAt!))}
          </p>
          {post.keyword && (
            <p className="mt-2 text-sm text-muted-foreground">
              This article was created using AI technology for the keyword:{' '}
              <strong>{post.keyword.keyword}</strong>
            </p>
          )}
        </footer>
      </article>

      {/* Related Posts */}
      <div className="border-t border-border bg-secondary/30">
        <div className="container mx-auto px-4 py-12">
          <h2 className="mb-8 text-2xl font-bold text-foreground">Related Posts</h2>
          {/* Related posts component would go here */}
          <p className="text-muted-foreground">More posts coming soon...</p>
        </div>
      </div>
    </main>
  );
}
