import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateComparisonKeywords, generateKeywords } from '@/lib/ai/openai-service';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { fetchKeywordSearchVolumes } from '@/lib/integrations/google-search-console';
import { decryptText } from '@/lib/security/crypto';
import { refreshAccessToken } from '@/lib/integrations/google-oauth';
import {
  estimateDifficulty,
  estimateIntent,
  estimateSearchVolume,
  type KeywordIntent,
} from '@/lib/seo/keyword-metrics';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    if (!Number.isNaN(status) && status >= 400 && status < 600) return status;
  }
  if (error instanceof Error && error.message.includes('429')) return 429;
  return 500;
}

function getUserFacingError(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 429) {
    return 'Gemini quota/rate limit exceeded. Retry shortly or use a key/project with available quota.';
  }
  return error instanceof Error ? error.message : 'Failed to generate keywords';
}

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function getRecentTrendHints(limit: number = 12): Promise<string[]> {
  try {
    const latest = await prisma.techNewsItem.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 25,
      select: { trendingKeywords: true },
    });

    const freq = new Map<string, number>();
    for (const row of latest) {
      for (const keyword of row.trendingKeywords || []) {
        const normalized = keyword.trim().toLowerCase();
        if (!normalized) continue;
        freq.set(normalized, (freq.get(normalized) || 0) + 1);
      }
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  } catch {
    return [];
  }
}

function calculatePriorityScore(params: {
  difficulty: number;
  searchVolume: number;
  intent: KeywordIntent;
  used: boolean;
}) {
  const { difficulty, searchVolume, intent, used } = params;
  const intentBonus =
    intent === 'comparison' ? 12 : intent === 'commercial' ? 10 : intent === 'transactional' ? 8 : 6;
  const score =
    Math.max(0, 100 - difficulty) * 0.5 +
    Math.min(100, Math.log10(Math.max(10, searchVolume)) * 25) * 0.4 +
    intentBonus -
    (used ? 25 : 0);
  return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}

type KeywordTrendStatus = 'up' | 'stable' | 'down' | 'new' | 'insufficient';

function computeTrendGrowthPct(last7: number, prev7: number): number | null {
  if (prev7 <= 0) return null;
  return Number((((last7 - prev7) / prev7) * 100).toFixed(1));
}

function classifyKeywordTrend(last7: number, prev7: number): KeywordTrendStatus {
  if (prev7 < 20 && last7 >= 50) return 'new';
  if (last7 === 0 && prev7 === 0) return 'insufficient';
  if (prev7 <= 0) return last7 > 0 ? 'new' : 'insufficient';
  const growth = ((last7 - prev7) / prev7) * 100;
  if (growth >= 20) return 'up';
  if (growth < -10) return 'down';
  return 'stable';
}

function formatKeywordForResponse(keyword: {
  id: string;
  keyword: string;
  niche: string;
  difficulty: number;
  searchVolume: number;
  generatedAt: Date;
  updatedAt: Date;
  posts?: Array<{ id: string }>;
  searchVolumeSource?: 'gsc' | 'estimated';
  searchVolumeStartDate?: string;
  searchVolumeEndDate?: string;
  trendStatus?: KeywordTrendStatus;
  trendGrowthPct?: number | null;
  trendImpressionsLast7?: number;
  trendImpressionsPrev7?: number;
}) {
  const derivedStatus = keyword.posts && keyword.posts.length > 0 ? 'used' : 'pending';
  const intent = estimateIntent(keyword.keyword);
  const priorityScore = calculatePriorityScore({
    difficulty: keyword.difficulty,
    searchVolume: keyword.searchVolume,
    intent,
    used: derivedStatus === 'used',
  });

  return {
    ...keyword,
    intent,
    priorityScore,
    searchVolumeSource: keyword.searchVolumeSource || 'estimated',
    searchVolumeStartDate: keyword.searchVolumeStartDate,
    searchVolumeEndDate: keyword.searchVolumeEndDate,
    trendStatus: keyword.trendStatus || 'insufficient',
    trendGrowthPct: keyword.trendGrowthPct ?? null,
    trendImpressionsLast7: keyword.trendImpressionsLast7 ?? 0,
    trendImpressionsPrev7: keyword.trendImpressionsPrev7 ?? 0,
    // Backward-compatible fields expected by existing admin UI.
    status: derivedStatus,
    createdAt: keyword.generatedAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const { niche, count = 5, mode = 'mixed' } = body;

    if (!niche) {
      return NextResponse.json(
        { error: 'Niche is required' },
        { status: 400 }
      );
    }

    const trendHints = await getRecentTrendHints(12);

    // Generate keywords using Gemini
    let keywords: string[] = [];
    if (mode === 'comparison') {
      keywords = await generateComparisonKeywords({ niche, count, trendHints });
    } else if (mode === 'standard') {
      keywords = await generateKeywords({ niche, count, includeComparison: false, trendHints });
    } else {
      keywords = await generateKeywords({ niche, count, includeComparison: true, trendHints });
    }

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    let gscVolumeMap = new Map<string, number>();
    const gscStartDate = dateNDaysAgo(30);
    const gscEndDate = dateNDaysAgo(1);
    let gscEnabled = false;

    if (websiteId) {
      try {
        const website = await prisma.website.findUnique({
          where: { id: websiteId },
          select: {
            gscProperty: true,
            gscRefreshTokenEnc: true,
          },
        });

        const siteUrl = website?.gscProperty?.trim() || process.env.GSC_SITE_URL?.trim();
        let accessToken = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN?.trim();
        if (!accessToken && website?.gscRefreshTokenEnc) {
          const refreshToken = decryptText(website.gscRefreshTokenEnc);
          accessToken = await refreshAccessToken(refreshToken);
        }

        if (siteUrl && accessToken) {
          gscVolumeMap = await fetchKeywordSearchVolumes({
            siteUrl,
            startDate: gscStartDate,
            endDate: gscEndDate,
            accessToken,
            keywords,
          });
          gscEnabled = true;
        }
      } catch (gscError) {
        // Non-fatal: keep keyword generation working even if GSC fetch fails.
        console.warn('[API] GSC keyword volume fetch skipped:', gscError);
      }
    }

    // Save keywords to database (upsert avoids failures on duplicate unique keywords)
    const savedKeywords = await Promise.all(
      keywords.map(async (keyword) => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        const intent = estimateIntent(keyword);
        const difficulty = estimateDifficulty(keyword);
        const gscSearchVolume = gscVolumeMap.get(normalizedKeyword);
        const searchVolume = Number.isFinite(gscSearchVolume)
          ? Number(gscSearchVolume)
          : estimateSearchVolume(keyword, intent);
        const searchVolumeSource: 'gsc' | 'estimated' = Number.isFinite(gscSearchVolume)
          ? 'gsc'
          : 'estimated';
        const existing = await prisma.keyword.findFirst({
          where: { keyword, websiteId },
        });

        if (existing) {
          const updated = await prisma.keyword.update({
            where: { id: existing.id },
            data: {
              niche,
              tenantId,
              websiteId,
              difficulty,
              searchVolume,
              updatedAt: new Date(),
            },
          });
          return {
            ...updated,
            searchVolumeSource,
            searchVolumeStartDate: searchVolumeSource === 'gsc' ? gscStartDate : undefined,
            searchVolumeEndDate: searchVolumeSource === 'gsc' ? gscEndDate : undefined,
          };
        }

        const created = await prisma.keyword.create({
          data: {
            keyword,
            niche,
            tenantId,
            websiteId,
            difficulty,
            searchVolume,
          },
        });
        return {
          ...created,
          searchVolumeSource,
          searchVolumeStartDate: searchVolumeSource === 'gsc' ? gscStartDate : undefined,
          searchVolumeEndDate: searchVolumeSource === 'gsc' ? gscEndDate : undefined,
        };
      })
    );

    return NextResponse.json({
      success: true,
      keywords: savedKeywords.map(formatKeywordForResponse),
      count: savedKeywords.length,
      searchVolumeMode: gscEnabled ? 'gsc+fallback' : 'estimated',
      searchVolumeRange: { startDate: gscStartDate, endDate: gscEndDate },
    });
  } catch (error) {
    console.error('[API] Keyword generation error:', error);
    return NextResponse.json(
      { error: getUserFacingError(error) },
      { status: getErrorStatus(error) }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const niche = searchParams.get('niche') || undefined;
    const q = searchParams.get('q') || undefined;
    const minDifficulty = searchParams.get('minDifficulty');
    const maxDifficulty = searchParams.get('maxDifficulty');
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
      ...(status === 'pending' && { posts: { none: {} } }),
      ...(status === 'used' && { posts: { some: {} } }),
      ...(niche && { niche: { contains: niche, mode: 'insensitive' as const } }),
      ...(q && { keyword: { contains: q, mode: 'insensitive' as const } }),
      ...((minDifficulty || maxDifficulty) && {
        difficulty: {
          ...(minDifficulty && { gte: Number(minDifficulty) }),
          ...(maxDifficulty && { lte: Number(maxDifficulty) }),
        },
      }),
    };

    const [keywords, total] = await Promise.all([
      prisma.keyword.findMany({
        where,
        include: {
          posts: {
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { generatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.keyword.count({ where }),
    ]);

    const gscStartDate = dateNDaysAgo(30);
    const gscEndDate = dateNDaysAgo(1);
    const trendLast7StartDate = dateNDaysAgo(7);
    const trendLast7EndDate = dateNDaysAgo(1);
    const trendPrev7StartDate = dateNDaysAgo(14);
    const trendPrev7EndDate = dateNDaysAgo(8);
    let gscVolumeMap = new Map<string, number>();
    let gscTrendLast7Map = new Map<string, number>();
    let gscTrendPrev7Map = new Map<string, number>();

    if (websiteId && keywords.length > 0) {
      try {
        const website = await prisma.website.findUnique({
          where: { id: websiteId },
          select: {
            gscProperty: true,
            gscRefreshTokenEnc: true,
          },
        });

        const siteUrl = website?.gscProperty?.trim() || process.env.GSC_SITE_URL?.trim();
        let accessToken = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN?.trim();
        if (!accessToken && website?.gscRefreshTokenEnc) {
          const refreshToken = decryptText(website.gscRefreshTokenEnc);
          accessToken = await refreshAccessToken(refreshToken);
        }

        if (siteUrl && accessToken) {
          const keywordList = keywords.map((row) => row.keyword);
          [gscVolumeMap, gscTrendLast7Map, gscTrendPrev7Map] = await Promise.all([
            fetchKeywordSearchVolumes({
              siteUrl,
              startDate: gscStartDate,
              endDate: gscEndDate,
              accessToken,
              keywords: keywordList,
            }),
            fetchKeywordSearchVolumes({
              siteUrl,
              startDate: trendLast7StartDate,
              endDate: trendLast7EndDate,
              accessToken,
              keywords: keywordList,
            }),
            fetchKeywordSearchVolumes({
              siteUrl,
              startDate: trendPrev7StartDate,
              endDate: trendPrev7EndDate,
              accessToken,
              keywords: keywordList,
            }),
          ]);
        }
      } catch (gscError) {
        // Non-fatal: keep keyword listing working even if GSC fetch fails.
        console.warn('[API] GSC keyword volume overlay skipped:', gscError);
      }
    }

    if (gscVolumeMap.size > 0) {
      await Promise.all(
        keywords.map(async (row) => {
          const normalized = row.keyword.trim().toLowerCase();
          const gscVolume = gscVolumeMap.get(normalized);
          if (!Number.isFinite(gscVolume)) return;
          if (row.searchVolume === Number(gscVolume)) return;
          await prisma.keyword.update({
            where: { id: row.id },
            data: { searchVolume: Number(gscVolume) },
          });
        })
      );
    }

    const formatted = keywords.map((row) => {
      const normalized = row.keyword.trim().toLowerCase();
      const gscVolume = gscVolumeMap.get(normalized);
      const hasGscVolume = Number.isFinite(gscVolume);
      const last7 = gscTrendLast7Map.get(normalized) || 0;
      const prev7 = gscTrendPrev7Map.get(normalized) || 0;
      const trendStatus = classifyKeywordTrend(last7, prev7);
      const trendGrowthPct = computeTrendGrowthPct(last7, prev7);
      return formatKeywordForResponse({
        ...row,
        searchVolume: hasGscVolume ? Number(gscVolume) : row.searchVolume,
        searchVolumeSource: hasGscVolume ? 'gsc' : 'estimated',
        searchVolumeStartDate: hasGscVolume ? gscStartDate : undefined,
        searchVolumeEndDate: hasGscVolume ? gscEndDate : undefined,
        trendStatus,
        trendGrowthPct,
        trendImpressionsLast7: last7,
        trendImpressionsPrev7: prev7,
      });
    });

    formatted.sort((a: { priorityScore: number; }, b: { priorityScore: number; }) => b.priorityScore - a.priorityScore);
    return NextResponse.json({
      keywords: formatted,
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
