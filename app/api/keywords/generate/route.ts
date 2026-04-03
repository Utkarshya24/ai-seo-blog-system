import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateComparisonKeywords, generateKeywords } from '@/lib/ai/openai-service';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { fetchKeywordSearchVolumes, fetchTopQueries, type GscTopQueryRow } from '@/lib/integrations/google-search-console';
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

type KeywordTrendStatus = 'up' | 'stable' | 'down' | 'new' | 'no_data' | 'not_available';
type KeywordTrendBasis = 'exact' | 'close_match' | 'none';
type MarketTrendStatus = 'up' | 'stable' | 'down' | 'no_data' | 'not_available';
type MarketTrendSource = 'google_trends' | 'tech_news' | 'none';

const NOISE_TOKENS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'best',
  'for',
  'from',
  'how',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);
const DATE_NOISE_TOKENS = new Set([
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'today',
  'latest',
  'new',
  'year',
]);

function tokenizeKeyword(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !NOISE_TOKENS.has(token));
}

function getTokenOverlapScore(keywordTokens: string[], queryTokens: string[]): number {
  if (keywordTokens.length === 0 || queryTokens.length === 0) return 0;
  const querySet = new Set(queryTokens);
  const overlap = keywordTokens.filter((token) => querySet.has(token)).length;
  return overlap;
}

function safeJsonParse<T>(text: string): T {
  return JSON.parse(text.replace(/^\)\]\}',?\n/, '')) as T;
}

function normalizeKeywordForMarket(value: string): string {
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !DATE_NOISE_TOKENS.has(token))
    .filter((token) => !/^\d{4}$/.test(token));

  // Keep market query compact to improve Google Trends match rate.
  return tokens.slice(0, 6).join(' ');
}

function classifyMarketTrend(last7: number, prev7: number): MarketTrendStatus {
  if (last7 === 0 && prev7 === 0) return 'no_data';
  if (prev7 <= 0) return last7 > 0 ? 'up' : 'no_data';
  const growth = ((last7 - prev7) / prev7) * 100;
  if (growth >= 20) return 'up';
  if (growth < -10) return 'down';
  return 'stable';
}

const marketTrendCache = new Map<
  string,
  { expiresAt: number; value: { marketTrendStatus: MarketTrendStatus; marketTrendGrowthPct: number | null; marketTrendLast7: number; marketTrendPrev7: number } }
>();

async function fetchGoogleTrendsMarketSignal(keyword: string): Promise<{
  marketTrendStatus: MarketTrendStatus;
  marketTrendGrowthPct: number | null;
  marketTrendLast7: number;
  marketTrendPrev7: number;
}> {
  const cacheKey = keyword.trim().toLowerCase();
  const cached = marketTrendCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const normalizedKeyword = normalizeKeywordForMarket(keyword);
    if (!normalizedKeyword) {
      return {
        marketTrendStatus: 'no_data',
        marketTrendGrowthPct: null,
        marketTrendLast7: 0,
        marketTrendPrev7: 0,
      };
    }
    const reqPayload = {
      comparisonItem: [{ keyword: normalizedKeyword, geo: 'US', time: 'today 3-m' }],
      category: 0,
      property: '',
    };
    const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(
      JSON.stringify(reqPayload)
    )}`;
    const exploreRes = await fetch(exploreUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
      cache: 'no-store',
    });
    if (!exploreRes.ok) throw new Error(`explore ${exploreRes.status}`);

    const exploreText = await exploreRes.text();
    const explore = safeJsonParse<{ widgets?: Array<{ id?: string; token?: string; request?: unknown }> }>(exploreText);
    const widget = (explore.widgets || []).find((row) => row.id === 'TIMESERIES');
    if (!widget?.token || !widget.request) throw new Error('missing timeseries widget');

    const multilineUrl =
      `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0` +
      `&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`;
    const multilineRes = await fetch(multilineUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
      cache: 'no-store',
    });
    if (!multilineRes.ok) throw new Error(`multiline ${multilineRes.status}`);

    const multilineText = await multilineRes.text();
    const multiline = safeJsonParse<{ default?: { timelineData?: Array<{ value?: number[] }> } }>(multilineText);
    const points = (multiline.default?.timelineData || [])
      .map((row) => Number(row.value?.[0] || 0))
      .filter((value) => Number.isFinite(value));

    if (points.length < 14) {
      const value = {
        marketTrendStatus: 'no_data' as MarketTrendStatus,
        marketTrendGrowthPct: null,
        marketTrendLast7: 0,
        marketTrendPrev7: 0,
      };
      marketTrendCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60 * 1000, value });
      return value;
    }

    const last7 = points.slice(-7).reduce((sum, value) => sum + value, 0);
    const prev7 = points.slice(-14, -7).reduce((sum, value) => sum + value, 0);
    const marketTrendGrowthPct = computeTrendGrowthPct(last7, prev7);
    const value = {
      marketTrendStatus: classifyMarketTrend(last7, prev7),
      marketTrendGrowthPct,
      marketTrendLast7: last7,
      marketTrendPrev7: prev7,
    };
    marketTrendCache.set(cacheKey, { expiresAt: Date.now() + 6 * 60 * 60 * 1000, value });
    return value;
  } catch (error) {
    console.warn('[API] Google Trends fetch failed:', error);
    const fallback = {
      marketTrendStatus: 'not_available' as MarketTrendStatus,
      marketTrendGrowthPct: null,
      marketTrendLast7: 0,
      marketTrendPrev7: 0,
    };
    marketTrendCache.set(cacheKey, { expiresAt: Date.now() + 30 * 60 * 1000, value: fallback });
    return fallback;
  }
}

function findCloseMatches(keyword: string, rows: GscTopQueryRow[], take: number = 3): GscTopQueryRow[] {
  const keywordTokens = tokenizeKeyword(keyword);
  if (keywordTokens.length === 0) return [];

  return rows
    .map((row) => {
      const queryTokens = tokenizeKeyword(row.query);
      const overlap = getTokenOverlapScore(keywordTokens, queryTokens);
      const overlapRatio = overlap / keywordTokens.length;
      return { ...row, overlap, overlapRatio };
    })
    .filter((row) => row.overlap >= 2 || row.overlapRatio >= 0.6)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return b.impressions - a.impressions;
    })
    .slice(0, take)
    .map((row) => ({ query: row.query, impressions: row.impressions }));
}

function buildTechNewsMarketSignalMap(rows: Array<{ fetchedAt: Date; trendingKeywords: string[] }>, keywords: string[]) {
  const now = new Date();
  const last7Start = new Date(now);
  last7Start.setDate(now.getDate() - 7);

  const map = new Map<
    string,
    { marketTrendStatus: MarketTrendStatus; marketTrendGrowthPct: number | null; marketTrendLast7: number; marketTrendPrev7: number }
  >();

  for (const keyword of keywords) {
    const normalized = keyword.trim().toLowerCase();
    const keywordTokens = tokenizeKeyword(keyword);
    if (keywordTokens.length === 0) {
      map.set(normalized, {
        marketTrendStatus: 'no_data',
        marketTrendGrowthPct: null,
        marketTrendLast7: 0,
        marketTrendPrev7: 0,
      });
      continue;
    }

    let last7 = 0;
    let prev7 = 0;
    for (const row of rows) {
      const rowTokens = new Set(
        (row.trendingKeywords || []).flatMap((item) => tokenizeKeyword(item))
      );
      const overlap = keywordTokens.filter((token) => rowTokens.has(token)).length;
      if (overlap === 0) continue;

      if (row.fetchedAt >= last7Start) {
        last7 += overlap;
      } else {
        prev7 += overlap;
      }
    }

    map.set(normalized, {
      marketTrendStatus: classifyMarketTrend(last7, prev7),
      marketTrendGrowthPct: computeTrendGrowthPct(last7, prev7),
      marketTrendLast7: last7,
      marketTrendPrev7: prev7,
    });
  }

  return map;
}

function computeTrendGrowthPct(last7: number, prev7: number): number | null {
  if (prev7 <= 0) return null;
  return Number((((last7 - prev7) / prev7) * 100).toFixed(1));
}

function classifyKeywordTrend(last7: number, prev7: number): Exclude<KeywordTrendStatus, 'not_available'> {
  if (prev7 < 20 && last7 >= 50) return 'new';
  if (last7 === 0 && prev7 === 0) return 'no_data';
  if (prev7 <= 0) return last7 > 0 ? 'new' : 'no_data';
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
  trendBasis?: KeywordTrendBasis;
  trendCloseMatches?: Array<{ query: string; impressions: number }>;
  marketTrendStatus?: MarketTrendStatus;
  marketTrendGrowthPct?: number | null;
  marketTrendLast7?: number;
  marketTrendPrev7?: number;
  marketTrendSource?: MarketTrendSource;
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
    trendStatus: keyword.trendStatus || 'not_available',
    trendGrowthPct: keyword.trendGrowthPct ?? null,
    trendImpressionsLast7: keyword.trendImpressionsLast7 ?? 0,
    trendImpressionsPrev7: keyword.trendImpressionsPrev7 ?? 0,
    trendBasis: keyword.trendBasis || 'none',
    trendCloseMatches: keyword.trendCloseMatches || [],
    marketTrendStatus: keyword.marketTrendStatus || 'not_available',
    marketTrendGrowthPct: keyword.marketTrendGrowthPct ?? null,
    marketTrendLast7: keyword.marketTrendLast7 ?? 0,
    marketTrendPrev7: keyword.marketTrendPrev7 ?? 0,
    marketTrendSource: keyword.marketTrendSource || 'none',
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
    let last7TopQueries: GscTopQueryRow[] = [];
    let prev7TopQueries: GscTopQueryRow[] = [];
    let gscAvailable = false;

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
          gscAvailable = true;
          const keywordList = keywords.map((row) => row.keyword);
          [gscVolumeMap, gscTrendLast7Map, gscTrendPrev7Map, last7TopQueries, prev7TopQueries] = await Promise.all([
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
            fetchTopQueries({
              siteUrl,
              startDate: trendLast7StartDate,
              endDate: trendLast7EndDate,
              accessToken,
            }),
            fetchTopQueries({
              siteUrl,
              startDate: trendPrev7StartDate,
              endDate: trendPrev7EndDate,
              accessToken,
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

    const marketSignals = await Promise.all(keywords.map((row) => fetchGoogleTrendsMarketSignal(row.keyword)));
    const techNewsRows = await prisma.techNewsItem.findMany({
      where: {
        fetchedAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        fetchedAt: true,
        trendingKeywords: true,
      },
      orderBy: { fetchedAt: 'desc' },
      take: 400,
    });
    const techNewsSignalMap = buildTechNewsMarketSignalMap(
      techNewsRows,
      keywords.map((row) => row.keyword)
    );

    const formatted = keywords.map((row, idx) => {
      const normalized = row.keyword.trim().toLowerCase();
      const gscVolume = gscVolumeMap.get(normalized);
      const hasGscVolume = Number.isFinite(gscVolume);
      const exactLast7 = gscTrendLast7Map.get(normalized) || 0;
      const exactPrev7 = gscTrendPrev7Map.get(normalized) || 0;
      const closeMatchesLast7 = findCloseMatches(row.keyword, last7TopQueries, 3);
      const closeMatchesPrev7 = findCloseMatches(row.keyword, prev7TopQueries, 3);
      const closeLast7 = closeMatchesLast7.reduce((sum, item) => sum + item.impressions, 0);
      const closePrev7 = closeMatchesPrev7.reduce((sum, item) => sum + item.impressions, 0);

      let trendBasis: KeywordTrendBasis = 'none';
      let last7 = 0;
      let prev7 = 0;

      if (exactLast7 > 0 || exactPrev7 > 0) {
        trendBasis = 'exact';
        last7 = exactLast7;
        prev7 = exactPrev7;
      } else if (closeLast7 > 0 || closePrev7 > 0) {
        trendBasis = 'close_match';
        last7 = closeLast7;
        prev7 = closePrev7;
      }

      const trendStatus: KeywordTrendStatus = gscAvailable ? classifyKeywordTrend(last7, prev7) : 'not_available';
      const trendGrowthPct = computeTrendGrowthPct(last7, prev7);
      const googleMarket = marketSignals[idx];
      const techNewsMarket = techNewsSignalMap.get(normalized);
      const shouldUseTechNews =
        googleMarket.marketTrendStatus === 'not_available' ||
        (googleMarket.marketTrendStatus === 'no_data' &&
          Boolean(techNewsMarket && (techNewsMarket.marketTrendLast7 > 0 || techNewsMarket.marketTrendPrev7 > 0)));
      const finalMarket = shouldUseTechNews && techNewsMarket ? techNewsMarket : googleMarket;
      const marketTrendSource: MarketTrendSource =
        shouldUseTechNews && techNewsMarket
          ? 'tech_news'
          : googleMarket.marketTrendStatus === 'not_available'
            ? 'none'
            : 'google_trends';

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
        trendBasis,
        trendCloseMatches: trendBasis === 'close_match' ? closeMatchesLast7 : [],
        marketTrendStatus: finalMarket.marketTrendStatus,
        marketTrendGrowthPct: finalMarket.marketTrendGrowthPct,
        marketTrendLast7: finalMarket.marketTrendLast7,
        marketTrendPrev7: finalMarket.marketTrendPrev7,
        marketTrendSource,
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
