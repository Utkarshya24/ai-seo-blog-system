import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

function classifyOpportunity(impressions: number, ctr: number, position: number) {
  if (impressions >= 500 && ctr < 2.5 && position <= 20) return 'high';
  if (impressions >= 200 && ctr < 3.5 && position <= 30) return 'medium';
  return 'low';
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
    };

    const [rows, total] = await Promise.all([
      prisma.seoMetrics.findMany({
        where,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              metaDescription: true,
              keyword: {
                select: {
                  keyword: true,
                },
              },
            },
          },
        },
        orderBy: [{ impressions: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.seoMetrics.count({ where }),
    ]);

    const opportunities = rows
      .map((row) => {
        const impressions = row.impressions > 0 ? row.impressions : row.traffic;
        const ctr = row.ctr > 0 ? row.ctr : impressions > 0 ? (row.clicks / impressions) * 100 : 0;
        const position = row.position > 0 ? row.position : row.ranking;
        const severity = classifyOpportunity(impressions, ctr, position);
        const targetCtr = position <= 10 ? 4.5 : 3.0;
        const missedClicks = Math.max(0, Math.round((targetCtr / 100) * impressions - row.clicks));

        return {
          postId: row.postId,
          title: row.post.title,
          slug: row.post.slug,
          keyword: row.post.keyword?.keyword || '',
          currentMetaDescription: row.post.metaDescription,
          impressions,
          clicks: row.clicks,
          ctr: Number(ctr.toFixed(2)),
          position: Number(position.toFixed(2)),
          source: row.source,
          severity,
          missedClicks,
          updatedAt: row.updatedAt,
        };
      })
      .filter((item) => item.impressions >= 100 && item.ctr < 5 && item.position > 0)
      .sort((a, b) => {
        const weight = { high: 3, medium: 2, low: 1 };
        const scoreA = weight[a.severity as 'high' | 'medium' | 'low'] * a.missedClicks;
        const scoreB = weight[b.severity as 'high' | 'medium' | 'low'] * b.missedClicks;
        return scoreB - scoreA;
      });

    return NextResponse.json({
      opportunities,
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[SEO Opportunities] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load opportunities' },
      { status: 500 }
    );
  }
}
