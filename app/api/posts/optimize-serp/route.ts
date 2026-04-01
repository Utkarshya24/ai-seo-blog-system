import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { generateSerpOptimization } from '@/lib/ai/openai-service';

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
        seoMetrics: true,
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

    const metrics = post.seoMetrics;
    const impressions = metrics?.impressions ?? 0;
    const clicks = metrics?.clicks ?? 0;
    const ctr = metrics?.ctr ?? (impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0);
    const position = metrics?.position ?? metrics?.ranking ?? 0;

    const optimized = await generateSerpOptimization({
      keyword: post.keyword?.keyword || post.title,
      currentTitle: post.title,
      currentMetaDescription: post.metaDescription,
      impressions,
      clicks,
      ctr,
      position,
    });

    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: {
        title: optimized.title,
        metaDescription: optimized.metaDescription,
      },
      include: {
        keyword: true,
      },
    });

    return NextResponse.json({
      success: true,
      post: updatedPost,
      optimization: {
        reasoning: optimized.reasoning,
      },
    });
  } catch (error) {
    console.error('[Post SERP Optimize] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to optimize post for SERP' },
      { status: 500 }
    );
  }
}
