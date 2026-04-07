import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

function toStatusFilter(status: string | null) {
  if (status === 'pending') return { posts: { none: {} } };
  if (status === 'used') return { posts: { some: {} } };
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status');
    const { page, limit, skip } = getPaginationParams(request);

    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(websiteId ? { websiteId } : {}),
      ...toStatusFilter(status),
      ...(q.trim()
        ? { keyword: { contains: q.trim(), mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await Promise.all([
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

    return NextResponse.json({
      keywords: rows.map((row) => ({
        id: row.id,
        keyword: row.keyword,
        status: row.posts.length > 0 ? 'used' : 'pending',
        generatedAt: row.generatedAt,
      })),
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[Keywords] search GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
