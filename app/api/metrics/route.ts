import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

function formatMetricsForResponse(metrics: {
  id: string;
  postId: string;
  backlinks: number;
  traffic: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ranking: number;
  position: number;
  source: string;
  fetchedAt: Date;
  updatedAt: Date;
}) {
  // Backward-compatible response contract used by current admin UI.
  const views = metrics.impressions > 0 ? metrics.impressions : metrics.traffic;
  const clicks = metrics.clicks > 0 ? metrics.clicks : Math.round(metrics.traffic * 0.05);
  const ctr =
    metrics.ctr > 0
      ? metrics.ctr
      : views > 0
        ? Number(((clicks / views) * 100).toFixed(2))
        : 0;

  return {
    ...metrics,
    views,
    clicks,
    ctr,
    avgTimeOnPage: Math.max(30, Math.round(360 - metrics.ranking * 2)),
    bounceRate: Math.max(20, Math.min(80, 70 - metrics.backlinks * 0.1)),
    createdAt: metrics.fetchedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (postId) {
      const metrics = await prisma.seoMetrics.findFirst({
        where: {
          postId,
          ...(tenantId && { tenantId }),
          ...(websiteId && { websiteId }),
        },
      });

      if (!metrics) {
        return NextResponse.json(
          { error: 'Metrics not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(formatMetricsForResponse(metrics));
    }

    // Get all metrics
    const allMetrics = await prisma.seoMetrics.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ metrics: allMetrics.map(formatMetricsForResponse) });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
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
    const {
      postId,
      views = 0,
      clicks = 0,
      impressions,
      ctr,
      backlinks,
      traffic,
      ranking,
      position,
      source = 'manual',
    } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, tenantId: true, websiteId: true },
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

    const metrics = await prisma.seoMetrics.upsert({
      where: { postId },
      update: {
        tenantId: post.tenantId,
        websiteId: post.websiteId,
        backlinks: backlinks ?? Math.max(0, Math.round(clicks / 2)),
        traffic: traffic ?? impressions ?? views,
        impressions: impressions ?? views,
        clicks,
        ctr:
          ctr ??
          ((impressions ?? views) > 0
            ? Number(((clicks / (impressions ?? views)) * 100).toFixed(2))
            : 0),
        ranking: ranking ?? 100,
        position: position ?? ranking ?? 100,
        source,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        postId,
        tenantId: post.tenantId,
        websiteId: post.websiteId,
        backlinks: backlinks ?? Math.max(0, Math.round(clicks / 2)),
        traffic: traffic ?? impressions ?? views,
        impressions: impressions ?? views,
        clicks,
        ctr:
          ctr ??
          ((impressions ?? views) > 0
            ? Number(((clicks / (impressions ?? views)) * 100).toFixed(2))
            : 0),
        ranking: ranking ?? 100,
        position: position ?? ranking ?? 100,
        source,
      },
    });

    return NextResponse.json({
      success: true,
      metrics: formatMetricsForResponse(metrics),
    });
  } catch (error) {
    console.error('[API] Error updating metrics:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update metrics',
      },
      { status: 500 }
    );
  }
}
