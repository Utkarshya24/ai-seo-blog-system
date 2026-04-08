import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handlePublicApiOptions, withPublicApiCors } from '@/lib/integrations/public-api';
import { resolveTenantContext } from '@/lib/tenant-context';

const CONTENT_API_KEY = process.env.CONTENT_API_KEY || '';

function calculateReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

function isAuthorized(request: NextRequest): boolean {
  if (!CONTENT_API_KEY) return true;
  const headerKey = request.headers.get('x-content-api-key');
  const queryKey = new URL(request.url).searchParams.get('apiKey');
  return headerKey === CONTENT_API_KEY || queryKey === CONTENT_API_KEY;
}

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantId, websiteId } = await resolveTenantContext(request);
    if (!isAuthorized(request)) {
      return withPublicApiCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const { slug } = await context.params;

    const post = await prisma.post.findFirst({
      where: {
        slug,
        status: 'published',
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
      },
      include: {
        keyword: true,
      },
    });

    if (!post) {
      return withPublicApiCors(NextResponse.json({ error: 'Post not found' }, { status: 404 }));
    }

    return withPublicApiCors(NextResponse.json({
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      metaDescription: post.metaDescription,
      status: post.status,
      coverImageUrl: post.coverImageUrl || null,
      coverImageAlt: post.coverImageAlt || null,
      coverImageDetails: (post.coverImageMeta as Record<string, unknown> | null) || null,
      publishedAt: post.publishedAt?.toISOString() || null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      readingTime: calculateReadingTime(post.content),
      niche: post.keyword?.niche || 'general',
      keyword: post.keyword?.keyword || null,
    }));
  } catch (error) {
    console.error('[API] Public post detail error:', error);
    return withPublicApiCors(NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch public post' },
      { status: 500 }
    ));
  }
}

export async function OPTIONS() {
  return handlePublicApiOptions();
}
