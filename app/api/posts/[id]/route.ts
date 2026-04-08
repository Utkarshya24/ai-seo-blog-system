import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { deleteCloudinaryImage, uploadImageToCloudinary } from '@/lib/integrations/cloudinary';

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
    const contentType = request.headers.get('content-type') || '';
    let title = '';
    let metaDescription = '';
    let content = '';
    let coverImageAlt = '';
    let removeCoverImage = false;
    let coverImageFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      title = String(form.get('title') || '').trim();
      metaDescription = String(form.get('metaDescription') || '').trim();
      content = String(form.get('content') || '').trim();
      coverImageAlt = String(form.get('coverImageAlt') || '').trim();
      removeCoverImage = String(form.get('removeCoverImage') || '').trim().toLowerCase() === 'true';
      const fileCandidate = form.get('coverImage');
      if (fileCandidate instanceof File && fileCandidate.size > 0) {
        coverImageFile = fileCandidate;
      }
    } else {
      const body = await request.json();
      title = String(body.title || '').trim();
      metaDescription = String(body.metaDescription || '').trim();
      content = String(body.content || '').trim();
      coverImageAlt = String(body.coverImageAlt || '').trim();
      removeCoverImage = Boolean(body.removeCoverImage);
    }

    if (!title || !metaDescription || !content) {
      return NextResponse.json(
        { error: 'title, metaDescription, and content are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        websiteId: true,
        coverImagePublicId: true,
        coverImageUrl: true,
        coverImageAlt: true,
      },
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

    const data: {
      title: string;
      metaDescription: string;
      content: string;
      updatedAt: Date;
      externalPushed: boolean;
      externalPushedAt: Date | null;
      coverImageUrl?: string | null;
      coverImagePublicId?: string | null;
      coverImageAlt?: string | null;
      coverImageMeta?: Record<string, unknown> | null;
    } = {
      title,
      metaDescription,
      content,
      updatedAt: new Date(),
      externalPushed: false,
      externalPushedAt: null,
    };

    if (coverImageFile) {
      const uploaded = await uploadImageToCloudinary({
        file: coverImageFile,
        publicId: existing.coverImagePublicId || `post-${existing.id}-${Date.now()}`,
      });

      data.coverImageUrl = uploaded.secureUrl;
      data.coverImagePublicId = uploaded.publicId;
      data.coverImageAlt = coverImageAlt || existing.coverImageAlt || title;
      data.coverImageMeta = uploaded;
    } else if (removeCoverImage) {
      if (existing.coverImagePublicId) {
        try {
          await deleteCloudinaryImage(existing.coverImagePublicId);
        } catch (cloudinaryError) {
          console.error('[Posts/:id] Cloudinary delete warning:', cloudinaryError);
        }
      }
      data.coverImageUrl = null;
      data.coverImagePublicId = null;
      data.coverImageAlt = null;
      data.coverImageMeta = null;
    } else if (coverImageAlt) {
      data.coverImageAlt = coverImageAlt;
    }

    const updated = await prisma.post.update({
      where: { id },
      data,
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
