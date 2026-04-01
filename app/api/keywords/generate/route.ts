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

  return {
    ...keyword,
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
              searchVolume: Math.floor(Math.random() * 5000) + 100,
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
            difficulty: Math.floor(Math.random() * 101), // Placeholder 0-100
            searchVolume: Math.floor(Math.random() * 5000) + 100, // Placeholder
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

    return NextResponse.json({ keywords: keywords.map(formatKeywordForResponse) });
  } catch (error) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
