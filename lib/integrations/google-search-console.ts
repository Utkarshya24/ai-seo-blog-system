import { prisma } from '@/lib/db';

export interface GscSyncInput {
  siteUrl: string;
  startDate: string;
  endDate: string;
  accessToken: string;
  rowLimit?: number;
  tenantId?: string | null;
  websiteId?: string | null;
}

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function extractSlugFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && segments[0] === 'blog') {
      return segments.slice(1).join('/');
    }
    return null;
  } catch {
    return null;
  }
}

function toPercentage(ctrFraction: number): number {
  return Number((ctrFraction * 100).toFixed(2));
}

export async function syncSearchConsoleMetrics(input: GscSyncInput) {
  const {
    siteUrl,
    startDate,
    endDate,
    accessToken,
    rowLimit = 1000,
    tenantId,
    websiteId,
  } = input;
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit,
      dataState: 'final',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`[GSC] Query failed (${response.status}): ${message}`);
  }

  const payload = (await response.json()) as { rows?: GscRow[] };
  const rows = payload.rows || [];
  const bySlug = new Map<
    string,
    { clicks: number; impressions: number; weightedPosition: number }
  >();

  for (const row of rows) {
    const pageUrl = row.keys?.[0];
    if (!pageUrl) continue;
    const slug = extractSlugFromUrl(pageUrl);
    if (!slug) continue;

    const clicks = Number(row.clicks || 0);
    const impressions = Number(row.impressions || 0);
    const position = Number(row.position || 0);

    const current = bySlug.get(slug) || {
      clicks: 0,
      impressions: 0,
      weightedPosition: 0,
    };

    current.clicks += clicks;
    current.impressions += impressions;
    current.weightedPosition += position * impressions;
    bySlug.set(slug, current);
  }

  let updated = 0;
  for (const [slug, aggregate] of bySlug.entries()) {
    const post = await prisma.post.findFirst({
      where: {
        slug,
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
      },
      select: { id: true, tenantId: true, websiteId: true },
    });

    if (!post) continue;

    const ctr = aggregate.impressions > 0 ? aggregate.clicks / aggregate.impressions : 0;
    const avgPosition =
      aggregate.impressions > 0 ? aggregate.weightedPosition / aggregate.impressions : 0;

    await prisma.seoMetrics.upsert({
      where: { postId: post.id },
      update: {
        tenantId: post.tenantId,
        websiteId: post.websiteId,
        traffic: aggregate.impressions,
        impressions: aggregate.impressions,
        clicks: aggregate.clicks,
        ctr: toPercentage(ctr),
        ranking: Math.round(avgPosition),
        position: Number(avgPosition.toFixed(2)),
        source: 'gsc',
        fetchedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        postId: post.id,
        tenantId: post.tenantId,
        websiteId: post.websiteId,
        traffic: aggregate.impressions,
        impressions: aggregate.impressions,
        clicks: aggregate.clicks,
        ctr: toPercentage(ctr),
        ranking: Math.round(avgPosition),
        position: Number(avgPosition.toFixed(2)),
        source: 'gsc',
      },
    });

    updated += 1;
  }

  return {
    totalRows: rows.length,
    matchedPosts: bySlug.size,
    updatedPosts: updated,
  };
}
