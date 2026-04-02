import { prisma } from '@/lib/db';
import { formatDate, generateSlug, generateTableOfContents } from '@/lib/utils/seo';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import { BlogCopyActions } from '@/components/blog-copy-actions';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRegex =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(
        <strong key={`${match.index}-${token}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-${token}`}
          className="rounded bg-secondary px-1.5 py-0.5 text-sm"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`${match.index}-${token}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(
        <em key={`${match.index}-${token}`}>
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderHeading(level: number, text: string, key: string) {
  const id = generateSlug(text);

  if (level <= 1) {
    return (
      <h1 key={key} id={id} className="mt-8 text-3xl font-bold">
        {renderInlineMarkdown(text)}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 key={key} id={id} className="mt-8 text-2xl font-bold">
        {renderInlineMarkdown(text)}
      </h2>
    );
  }

  if (level === 3) {
    return (
      <h3 key={key} id={id} className="mt-6 text-xl font-bold">
        {renderInlineMarkdown(text)}
      </h3>
    );
  }

  if (level === 4) {
    return (
      <h4 key={key} id={id} className="mt-5 text-lg font-semibold">
        {renderInlineMarkdown(text)}
      </h4>
    );
  }

  if (level === 5) {
    return (
      <h5 key={key} id={id} className="mt-5 text-base font-semibold">
        {renderInlineMarkdown(text)}
      </h5>
    );
  }

  return (
    <h6 key={key} id={id} className="mt-4 text-sm font-semibold uppercase tracking-wide">
      {renderInlineMarkdown(text)}
    </h6>
  );
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutOuterPipes.split('|').map((cell) => cell.trim());
}

function isMarkdownTableDelimiter(line: string): boolean {
  const cells = parseTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderMarkdownContent(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const fence = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre key={`code-${i}`} className="overflow-x-auto rounded-lg bg-secondary p-4 text-sm">
          <code className={fence ? `language-${fence}` : undefined}>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push(renderHeading(headingMatch[1].length, headingMatch[2].trim(), `h-${i}`));
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      nodes.push(<hr key={`hr-${i}`} className="my-8 border-border" />);
      i += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s+/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s+/, ''));
        i += 1;
      }
      nodes.push(
        <blockquote key={`quote-${i}`} className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
          {renderInlineMarkdown(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^[-*+]\s+/, '');
        items.push(<li key={`ul-${i}`}>{renderInlineMarkdown(item)}</li>);
        i += 1;
      }
      nodes.push(
        <ul key={`list-${i}`} className="list-disc space-y-2 pl-6">
          {items}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^\d+\.\s+/, '');
        items.push(<li key={`ol-${i}`}>{renderInlineMarkdown(item)}</li>);
        i += 1;
      }
      nodes.push(
        <ol key={`olist-${i}`} className="list-decimal space-y-2 pl-6">
          {items}
        </ol>
      );
      continue;
    }

    const hasTablePipe = line.includes('|');
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (hasTablePipe && nextLine && nextLine.includes('|') && isMarkdownTableDelimiter(nextLine)) {
      const headerCells = parseTableRow(line);
      i += 2; // skip header + delimiter

      const bodyRows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes('|')) break;
        bodyRows.push(parseTableRow(rowLine));
        i += 1;
      }

      nodes.push(
        <div key={`table-${i}`} className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                {headerCells.map((cell, idx) => (
                  <th key={`th-${idx}`} className="px-3 py-2 font-semibold">
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`} className="border-b border-border/60 align-top">
                  {headerCells.map((_, colIdx) => (
                    <td key={`td-${rowIdx}-${colIdx}`} className="px-3 py-2">
                      {renderInlineMarkdown(row[colIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraphLines: string[] = [lines[i].trim()];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^>\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    nodes.push(
      <p key={`p-${i}`} className="leading-7">
        {renderInlineMarkdown(paragraphLines.join(' '))}
      </p>
    );
  }

  return nodes;
}

function calculateReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
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

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
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
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      type: 'article',
      url: `${APP_URL}/blog/${post.slug}`,
      publishedTime: post.publishedAt?.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription,
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
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: `${APP_URL}/blog/${post.slug}`,
    keywords: post.keyword?.keyword ?? '',
    author: {
      '@type': 'Organization',
      name: 'AI SEO Blog System',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AI SEO Blog System',
      logo: {
        '@type': 'ImageObject',
        url: `${APP_URL}/icon-light-32x32.png`,
      },
    },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Blog',
        item: `${APP_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: post.title,
        item: `${APP_URL}/blog/${post.slug}`,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
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
            <span>{calculateReadingTime(post.content)} min read</span>

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

          <BlogCopyActions markdown={post.content} />
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
          {renderMarkdownContent(post.content)}
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
