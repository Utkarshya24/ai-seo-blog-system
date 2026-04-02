import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handlePublicApiOptions, withPublicApiCors } from '@/lib/integrations/public-api';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

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

export async function GET(request: NextRequest) {
  try {
    const { tenantId, websiteId } = await resolveTenantContext(request);
    if (!isAuthorized(request)) {
      return withPublicApiCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }

    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') || undefined;
    const q = searchParams.get('q') || undefined;
    const { page, limit, skip } = getPaginationParams(request);
    const includeContent = searchParams.get('includeContent') === 'true';

    const where = {
      status: 'published',
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
      ...(niche && { keyword: { niche: { contains: niche, mode: 'insensitive' as const } } }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { content: { contains: q, mode: 'insensitive' as const } },
          { metaDescription: { contains: q, mode: 'insensitive' as const } },
          { keyword: { keyword: { contains: q, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: { keyword: true },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return withPublicApiCors(NextResponse.json({
      pagination: getPaginationMeta({ page, limit, total }),
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        metaDescription: post.metaDescription,
        status: post.status,
        publishedAt: post.publishedAt?.toISOString() || null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        readingTime: calculateReadingTime(post.content),
        niche: post.keyword?.niche || 'general',
        keyword: post.keyword?.keyword || null,
        ...(includeContent ? { content: post.content } : {}),
      })),
    }));
  } catch (error) {
    console.error('[API] Public posts feed error:', error);
    return withPublicApiCors(NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch public posts' },
      { status: 500 }
    ));
  }
}

export async function OPTIONS() {
  return handlePublicApiOptions();
}
