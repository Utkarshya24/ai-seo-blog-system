import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { autoInsertInternalLinks, suggestInternalLinks } from '@/lib/seo/internal-linking';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const postId = String(body.postId || '').trim();
    const maxLinks = Math.min(8, Math.max(1, Number(body.maxLinks || 3)));

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
        keyword: { select: { keyword: true } },
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
      })),
      limit: 20,
    });

    const { content, insertedLinks } = autoInsertInternalLinks({
      content: sourcePost.content,
      candidates: suggestions,
      maxLinks,
    });

    if (insertedLinks.length === 0) {
      return NextResponse.json({
        success: true,
        updated: false,
        insertedLinks: [],
        post: {
          id: sourcePost.id,
          title: sourcePost.title,
          slug: sourcePost.slug,
        },
      });
    }

    const updatedPost = await prisma.post.update({
      where: { id: sourcePost.id },
      data: {
        content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: true,
      insertedLinks,
      post: {
        id: updatedPost.id,
        title: updatedPost.title,
        slug: updatedPost.slug,
      },
    });
  } catch (error) {
    console.error('[Auto Internal Link] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto insert internal links' },
      { status: 500 }
    );
  }
}
