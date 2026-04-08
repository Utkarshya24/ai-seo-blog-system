import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const { postId, forceRepublish = false } = body as { postId?: string; forceRepublish?: boolean };

    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (tenantId && existing.tenantId && existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Post does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && existing.websiteId && existing.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Post does not belong to website' }, { status: 403 });
    }

    const alreadyPublishedWithoutChanges =
      existing.status === 'published' &&
      existing.publishedAt &&
      existing.updatedAt.getTime() <= existing.publishedAt.getTime();

    if (alreadyPublishedWithoutChanges && !forceRepublish) {
      return NextResponse.json(
        {
          error: 'Post is already published with no new changes. Update the content first to publish again.',
          alreadyPublished: true,
        },
        { status: 409 }
      );
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
      include: {
        keyword: true,
      },
    });

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('[API] Publish error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to publish post',
      },
      { status: 500 }
    );
  }
}
