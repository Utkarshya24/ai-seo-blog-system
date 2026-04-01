import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { suggestInternalLinks } from '@/lib/seo/internal-linking';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const postId = String(searchParams.get('postId') || '').trim();

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const sourcePost = await prisma.post.findUnique({
      where: { id: postId },
      include: { keyword: true },
    });

    if (!sourcePost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (tenantId && sourcePost.tenantId && sourcePost.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Post does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && sourcePost.websiteId && sourcePost.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Post does not belong to website' }, { status: 403 });
    }

    const candidates = await prisma.post.findMany({
      where: {
        id: { not: postId },
        status: 'published',
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
      },
      include: {
        keyword: {
          select: { keyword: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 80,
    });

    const suggestions = suggestInternalLinks({
      sourceTitle: sourcePost.title,
      sourceKeyword: sourcePost.keyword?.keyword,
      sourceContent: sourcePost.content,
      candidates: candidates.map((candidate) => ({
        postId: candidate.id,
        slug: candidate.slug,
        title: candidate.title,
        keyword: candidate.keyword?.keyword,
        content: candidate.content,
        metaDescription: candidate.metaDescription,
      })),
      limit: 20,
    });

    return NextResponse.json({
      postId: sourcePost.id,
      suggestions,
    });
  } catch (error) {
    console.error('[Internal Link Opportunities] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch link opportunities' },
      { status: 500 }
    );
  }
}
