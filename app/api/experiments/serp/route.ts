import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, ExperimentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { generateSerpOptimization } from '@/lib/ai/openai-service';
import { calculateCtr } from '@/lib/experiments/serp';

function formatExperiment(experiment: {
  id: string;
  postId: string;
  status: ExperimentStatus;
  variantATitle: string;
  variantAMetaDescription: string;
  variantBTitle: string;
  variantBMetaDescription: string;
  impressionsA: number;
  clicksA: number;
  impressionsB: number;
  clicksB: number;
  winner: 'A' | 'B' | null;
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
  post?: { title: string; slug: string };
}) {
  return {
    ...experiment,
    ctrA: calculateCtr(experiment.clicksA, experiment.impressionsA),
    ctrB: calculateCtr(experiment.clicksB, experiment.impressionsB),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId') || undefined;
    const status = searchParams.get('status') as ExperimentStatus | null;

    const experiments = await prisma.serpExperiment.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
        ...(postId && { postId }),
        ...(status && { status }),
      },
      include: {
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ experiments: experiments.map(formatExperiment) });
  } catch (error) {
    console.error('[SERP Experiment] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch SERP experiments' },
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

    const active = await prisma.serpExperiment.findFirst({
      where: {
        postId: post.id,
        status: ExperimentStatus.RUNNING,
      },
      select: { id: true },
    });

    if (active) {
      return NextResponse.json(
        { error: 'A running SERP experiment already exists for this post.' },
        { status: 409 }
      );
    }

    let variantBTitle = String(body.variantBTitle || '').trim();
    let variantBMetaDescription = String(body.variantBMetaDescription || '').trim();

    if (!variantBTitle || !variantBMetaDescription) {
      const metrics = post.seoMetrics;
      const impressions = metrics?.impressions ?? 0;
      const clicks = metrics?.clicks ?? 0;
      const ctr = metrics?.ctr ?? (impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0);
      const position = metrics?.position ?? metrics?.ranking ?? 0;

      const generated = await generateSerpOptimization({
        keyword: post.keyword?.keyword || post.title,
        currentTitle: post.title,
        currentMetaDescription: post.metaDescription,
        impressions,
        clicks,
        ctr,
        position,
      });

      variantBTitle = variantBTitle || generated.title;
      variantBMetaDescription = variantBMetaDescription || generated.metaDescription;
    }

    const experiment = await prisma.serpExperiment.create({
      data: {
        tenantId: post.tenantId,
        websiteId: post.websiteId,
        postId: post.id,
        variantATitle: post.title,
        variantAMetaDescription: post.metaDescription,
        variantBTitle,
        variantBMetaDescription,
        status: ExperimentStatus.RUNNING,
      },
      include: {
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, experiment: formatExperiment(experiment) });
  } catch (error) {
    console.error('[SERP Experiment] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start SERP experiment' },
      { status: 500 }
    );
  }
}
