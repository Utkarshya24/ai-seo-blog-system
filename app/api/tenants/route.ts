import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateSlug } from '@/lib/utils/seo';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { auth } = authResult;
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      ...(auth.isGlobal ? {} : { id: auth.tenantId || '' }),
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          websites: {
            where: { isActive: true },
            select: { id: true, name: true, domain: true, baseUrl: true, niche: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    return NextResponse.json({
      tenants,
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.OWNER);
    if (!authResult.ok) return authResult.response;
    if (!authResult.auth.isGlobal) {
      return NextResponse.json(
        { error: 'Only global owner token can create tenants' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    const slugInput = String(body.slug || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const baseSlug = generateSlug(slugInput || name);
    let slug = baseSlug;
    let suffix = 1;

    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const tenant = await prisma.tenant.create({
      data: { name, slug },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create tenant' },
      { status: 500 }
    );
  }
}
