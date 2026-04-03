import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateBlogPost, generateMetaDescription } from '@/lib/ai/openai-service';
import { generateSlug, isValidSeoTitle, SEO_TITLE_MAX_LENGTH, toSeoTitle } from '@/lib/utils/seo';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';
import { auditPostSeo } from '@/lib/seo/content-audit';
import { fetchPageSpeedMetrics } from '@/lib/integrations/pagespeed';

const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY?.trim() || '';

function resolvePostUrl(baseUrl: string | null | undefined, slug: string): string | null {
  const raw = String(baseUrl || '').trim();
  if (!raw || !slug.trim()) return null;
  try {
    const parsed = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(`https://${raw}`);
    const cleanBase = parsed.toString().replace(/\/$/, '');
    return `${cleanBase}/blog/${slug}`;
  } catch {
    return null;
  }
}

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    if (!Number.isNaN(status) && status >= 400 && status < 600) return status;
  }
  if (error instanceof Error && error.message.includes('429')) return 429;
  return 500;
}

function getUserFacingError(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 429) {
    return 'Gemini quota/rate limit exceeded. Retry shortly or use a key/project with available quota.';
  }
  return error instanceof Error ? error.message : 'Failed to generate blog post';
}

function calculateReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const { keywordId, title, tone = 'professional' } = body;

    if (!keywordId || !title) {
      return NextResponse.json(
        { error: 'keywordId and title are required' },
        { status: 400 }
      );
    }

    const normalizedTitle = toSeoTitle(String(title));
    if (!isValidSeoTitle(normalizedTitle)) {
      return NextResponse.json(
        { error: `Title must be between 1 and ${SEO_TITLE_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Fetch keyword
    const keyword = await prisma.keyword.findUnique({
      where: { id: keywordId },
    });

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword not found' },
        { status: 404 }
      );
    }
    if (tenantId && keyword.tenantId && keyword.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Keyword does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && keyword.websiteId && keyword.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Keyword does not belong to website' }, { status: 403 });
    }

    // Generate blog content
    const content = await generateBlogPost({
      keyword: keyword.keyword,
      title: normalizedTitle,
      tone,
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate blog post' },
        { status: 500 }
      );
    }

    // Generate meta description
    const metaDescription = await generateMetaDescription(normalizedTitle, content);

    // Create post in database
    const slug = await generateUniqueSlug(normalizedTitle);
    const post = await prisma.post.create({
      data: {
        title: normalizedTitle,
        content,
        slug,
        keywordId,
        tenantId,
        websiteId,
        metaDescription,
        status: 'draft',
      },
      include: {
        keyword: true,
        seoMetrics: true,
        website: {
          select: {
            domain: true,
            baseUrl: true,
          },
        },
      },
    });

    const postUrl = resolvePostUrl(post.website?.baseUrl || post.website?.domain, post.slug);
    const pageSpeed =
      postUrl
        ? await fetchPageSpeedMetrics({
            url: postUrl,
            strategy: 'mobile',
            apiKey: PAGESPEED_API_KEY,
          })
        : null;

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        readingTime: calculateReadingTime(post.content),
        seoAudit: auditPostSeo({
          title: post.title,
          metaDescription: post.metaDescription,
          content: post.content,
          keyword: post.keyword?.keyword || post.title,
          metrics: {
            ...post.seoMetrics,
            pageSpeedPerformanceScore: pageSpeed?.performanceScore || 0,
          },
        }),
      },
    });
  } catch (error) {
    console.error('[API] Blog generation error:', error);
    return NextResponse.json(
      { error: getUserFacingError(error) },
      { status: getErrorStatus(error) }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const keywordId = searchParams.get('keywordId') || undefined;
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
      ...(status && { status }),
      ...(keywordId && { keywordId }),
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          keyword: true,
          seoMetrics: true,
          website: {
            select: {
              domain: true,
              baseUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    const pageSpeedMap = new Map<string, number>();
    await Promise.all(
      posts.map(async (post) => {
        const postUrl = resolvePostUrl(post.website?.baseUrl || post.website?.domain, post.slug);
        if (!postUrl) return;
        const metrics = await fetchPageSpeedMetrics({
          url: postUrl,
          strategy: 'mobile',
          apiKey: PAGESPEED_API_KEY,
        });
        if (metrics?.performanceScore) {
          pageSpeedMap.set(post.id, metrics.performanceScore);
        }
      })
    );

    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        readingTime: calculateReadingTime(post.content),
        seoAudit: auditPostSeo({
          title: post.title,
          metaDescription: post.metaDescription,
          content: post.content,
          keyword: post.keyword?.keyword || post.title,
          metrics: {
            ...post.seoMetrics,
            pageSpeedPerformanceScore: pageSpeedMap.get(post.id) || 0,
          },
        }),
      })),
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
