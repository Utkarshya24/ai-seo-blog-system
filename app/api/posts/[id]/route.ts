import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { id } = await context.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        keyword: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (tenantId && post.tenantId && post.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Post does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && post.websiteId && post.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Post does not belong to website' }, { status: 403 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    console.error('[Posts/:id] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch post' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { id } = await context.params;
    const body = await request.json();

    const title = String(body.title || '').trim();
    const metaDescription = String(body.metaDescription || '').trim();
    const content = String(body.content || '').trim();

    if (!title || !metaDescription || !content) {
      return NextResponse.json(
        { error: 'title, metaDescription, and content are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.post.findUnique({
      where: { id },
      select: { id: true, tenantId: true, websiteId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (tenantId && existing.tenantId && existing.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Post does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && existing.websiteId && existing.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Post does not belong to website' }, { status: 403 });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        title,
        metaDescription,
        content,
        updatedAt: new Date(),
      },
      include: {
        keyword: true,
      },
    });

    return NextResponse.json({ success: true, post: updated });
  } catch (error) {
    console.error('[Posts/:id] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update post' },
      { status: 500 }
    );
  }
}
