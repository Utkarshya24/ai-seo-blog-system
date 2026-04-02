import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { getTrendingTechNews, refreshTrendingTechNews } from '@/lib/trends/tech-news';
import { getPaginationParams } from '@/lib/api/pagination';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(request);
    const data = await getTrendingTechNews({ page, limit });
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('[TechNews] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tech news' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const body = await request.json().catch(() => ({}));
    const maxPerSource = Number(body.maxPerSource || 12);
    const refreshed = await refreshTrendingTechNews({ maxPerSource });
    const data = await getTrendingTechNews({ limit: 20 });
    return NextResponse.json({
      success: true,
      refresh: refreshed,
      ...data,
    });
  } catch (error) {
    console.error('[TechNews] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh tech news' },
      { status: 500 }
    );
  }
}
