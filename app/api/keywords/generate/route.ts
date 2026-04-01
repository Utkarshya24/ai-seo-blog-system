import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateComparisonKeywords, generateKeywords } from '@/lib/ai/openai-service';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

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

type KeywordIntent = 'informational' | 'comparison' | 'commercial' | 'transactional';

function estimateIntent(keyword: string): KeywordIntent {
  const text = keyword.toLowerCase();
  if (/\b(vs|versus|alternative|compare)\b/.test(text)) return 'comparison';
  if (/\b(price|pricing|buy|best|top|review|reviews)\b/.test(text)) return 'commercial';
  if (/\b(sign up|template|download|tool|software)\b/.test(text)) return 'transactional';
  return 'informational';
}

function estimateDifficulty(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  const hasBrand = /\b(google|facebook|openai|apple|amazon|microsoft)\b/i.test(keyword);
  let score = 35 + Math.max(0, 6 - words) * 8;
  if (hasBrand) score += 8;
  return Math.min(95, Math.max(12, score));
}

function estimateSearchVolume(keyword: string, intent: KeywordIntent): number {
  const base = Math.max(120, 2200 - keyword.length * 20);
  if (intent === 'comparison') return Math.round(base * 1.15);
  if (intent === 'commercial') return Math.round(base * 1.1);
  return Math.round(base);
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

function formatKeywordForResponse(keyword: {
  id: string;
  keyword: string;
  niche: string;
  difficulty: number;
  searchVolume: number;
  generatedAt: Date;
  updatedAt: Date;
  posts?: Array<{ id: string }>;
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

    // Generate keywords using Gemini
    let keywords: string[] = [];
    if (mode === 'comparison') {
      keywords = await generateComparisonKeywords({ niche, count });
    } else if (mode === 'standard') {
      keywords = await generateKeywords({ niche, count, includeComparison: false });
    } else {
      keywords = await generateKeywords({ niche, count, includeComparison: true });
    }

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    // Save keywords to database (upsert avoids failures on duplicate unique keywords)
    const savedKeywords = await Promise.all(
      keywords.map(async (keyword) => {
        const intent = estimateIntent(keyword);
        const difficulty = estimateDifficulty(keyword);
        const searchVolume = estimateSearchVolume(keyword, intent);
        const existing = await prisma.keyword.findFirst({
          where: { keyword, websiteId },
        });

        if (existing) {
          return prisma.keyword.update({
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
        }

        return prisma.keyword.create({
          data: {
            keyword,
            niche,
            tenantId,
            websiteId,
            difficulty,
            searchVolume,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      keywords: savedKeywords.map(formatKeywordForResponse),
      count: savedKeywords.length,
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

    const keywords = await prisma.keyword.findMany({
      where: {
        ...(tenantId && { tenantId }),
        ...(websiteId && { websiteId }),
        ...(status === 'pending' && { posts: { none: {} } }),
        ...(status === 'used' && { posts: { some: {} } }),
        ...(niche && { niche: { contains: niche, mode: 'insensitive' } }),
        ...(q && { keyword: { contains: q, mode: 'insensitive' } }),
        ...((minDifficulty || maxDifficulty) && {
          difficulty: {
            ...(minDifficulty && { gte: Number(minDifficulty) }),
            ...(maxDifficulty && { lte: Number(maxDifficulty) }),
          },
        }),
      },
      include: {
        posts: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });

    const formatted = keywords.map(formatKeywordForResponse);
    formatted.sort((a, b) => b.priorityScore - a.priorityScore);
    return NextResponse.json({ keywords: formatted });
  } catch (error) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
