import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { normalizeUrl, parseProvider } from '@/lib/visibility/utils';

interface MentionInput {
  provider: string;
  query: string;
  citedUrl: string;
  sourceUrl?: string;
  rank?: number;
  snippet?: string;
  detectedAt?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || undefined;
    const q = searchParams.get('q') || undefined;
    const days = Math.max(1, Math.min(180, Number(searchParams.get('days') || 30)));

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const mentions = await prisma.aiVisibilityMention.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
        detectedAt: { gte: fromDate },
        ...(provider && { provider: parseProvider(provider) }),
        ...(q && { query: { contains: q, mode: 'insensitive' } }),
      },
      orderBy: [{ detectedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ mentions });
  } catch (error) {
    console.error('[AI Visibility] GET mentions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI visibility mentions' },
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
    const mentionsRaw = Array.isArray(body.mentions) ? (body.mentions as MentionInput[]) : [];

    if (mentionsRaw.length === 0) {
      return NextResponse.json({ error: 'mentions[] is required' }, { status: 400 });
    }

    const prepared = mentionsRaw
      .map((mention) => {
        const query = String(mention.query || '').trim();
        const citedUrl = normalizeUrl(String(mention.citedUrl || ''));
        if (!query || !citedUrl) return null;

        return {
          tenantId,
          websiteId,
          provider: parseProvider(String(mention.provider || 'OTHER')),
          query,
          citedUrl,
          sourceUrl: mention.sourceUrl ? normalizeUrl(String(mention.sourceUrl)) : null,
          rank: Number.isFinite(Number(mention.rank)) ? Number(mention.rank) : null,
          snippet: mention.snippet ? String(mention.snippet).slice(0, 1200) : null,
          detectedAt: mention.detectedAt ? new Date(mention.detectedAt) : new Date(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (prepared.length === 0) {
      return NextResponse.json({ error: 'No valid mentions in payload' }, { status: 400 });
    }

    await prisma.aiVisibilityMention.createMany({
      data: prepared,
    });

    return NextResponse.json({ success: true, ingested: prepared.length });
  } catch (error) {
    console.error('[AI Visibility] POST mentions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ingest AI visibility mentions' },
      { status: 500 }
    );
  }
}
