import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateBlogPost, generateMetaDescription } from '@/lib/ai/openai-service';
import { generateSlug, isValidSeoTitle, SEO_TITLE_MAX_LENGTH, toSeoTitle } from '@/lib/utils/seo';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

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
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        readingTime: calculateReadingTime(post.content),
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

    const posts = await prisma.post.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
        ...(status && { status }),
        ...(keywordId && { keywordId }),
      },
      include: {
        keyword: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        readingTime: calculateReadingTime(post.content),
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
