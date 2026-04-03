import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, SocialPlatform } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { generateSocialPosts } from '@/lib/ai/openai-service';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

function toSocialUrl(baseUrl: string, slug: string): string {
  const clean = baseUrl.replace(/\/$/, '');
  return `${clean}/blog/${slug}`;
}

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
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      postId,
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
    };

    const [drafts, total] = await Promise.all([
      prisma.socialPostDraft.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.socialPostDraft.count({ where }),
    ]);

    return NextResponse.json({
      drafts,
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[Social] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch social drafts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const postId = String(body.postId || '').trim();

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        keyword: true,
        website: {
          select: { baseUrl: true },
        },
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

    const baseUrl = post.website?.baseUrl?.trim();
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Website baseUrl is missing for this post. Configure website base URL first.' },
        { status: 400 }
      );
    }

    const url = toSocialUrl(baseUrl, post.slug);
    const generated = await generateSocialPosts({
      title: post.title,
      keyword: post.keyword?.keyword || post.title,
      metaDescription: post.metaDescription,
      url,
    });

    const [linkedinDraft, xDraft] = await Promise.all([
      prisma.socialPostDraft.create({
        data: {
          tenantId: post.tenantId,
          websiteId: post.websiteId,
          postId: post.id,
          platform: SocialPlatform.LINKEDIN,
          content: generated.linkedin.content,
          hashtags: generated.linkedin.hashtags,
          callToAction: generated.linkedin.callToAction,
        },
      }),
      prisma.socialPostDraft.create({
        data: {
          tenantId: post.tenantId,
          websiteId: post.websiteId,
          postId: post.id,
          platform: SocialPlatform.X,
          content: generated.x.content,
          hashtags: generated.x.hashtags,
          callToAction: generated.x.callToAction,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      drafts: {
        linkedin: linkedinDraft,
        x: xDraft,
      },
    });
  } catch (error) {
    console.error('[Social] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate social drafts' },
      { status: 500 }
    );
  }
}
