import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { hostFromUrl } from '@/lib/visibility/utils';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const days = Math.max(1, Math.min(180, Number(searchParams.get('days') || 30)));

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const website = websiteId
      ? await prisma.website.findUnique({
          where: { id: websiteId },
          select: { domain: true, baseUrl: true },
        })
      : null;

    const targetHost = website?.domain?.toLowerCase() || (website?.baseUrl ? hostFromUrl(website.baseUrl) : null);

    const mentions = await prisma.aiVisibilityMention.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
        detectedAt: { gte: fromDate },
      },
      orderBy: { detectedAt: 'desc' },
      take: 1000,
    });

    const totalMentions = mentions.length;
    const citedMentions = mentions.filter((m) => {
      if (!targetHost) return false;
      const host = hostFromUrl(m.citedUrl);
      return Boolean(host && (host === targetHost || host.endsWith(`.${targetHost}`)));
    }).length;

    const citationRate = totalMentions > 0 ? Number(((citedMentions / totalMentions) * 100).toFixed(2)) : 0;

    const providerBreakdown = mentions.reduce<Record<string, number>>((acc, item) => {
      acc[item.provider] = (acc[item.provider] || 0) + 1;
      return acc;
    }, {});

    const queryBreakdown = mentions.reduce<Record<string, number>>((acc, item) => {
      const key = item.query.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topQueries = Object.entries(queryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return NextResponse.json({
      windowDays: days,
      totalMentions,
      citedMentions,
      citationRate,
      targetHost,
      providerBreakdown,
      topQueries,
    });
  } catch (error) {
    console.error('[AI Visibility] GET summary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI visibility summary' },
      { status: 500 }
    );
  }
}
