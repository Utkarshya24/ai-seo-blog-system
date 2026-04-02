import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashToken, requireAdminAuth } from '@/lib/auth/admin-auth';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

function generateRawToken(): string {
  return `seo_${crypto.randomBytes(24).toString('hex')}`;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request, AdminRole.OWNER);
  if (!authResult.ok) return authResult.response;

  const auth = authResult.auth;
  const { page, limit, skip } = getPaginationParams(request);
  const where = {
    ...(auth.isGlobal ? {} : { tenantId: auth.tenantId || '' }),
  };
  const [tokens, total] = await Promise.all([
    prisma.adminToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        lastFour: true,
        role: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: limit,
    }),
    prisma.adminToken.count({ where }),
  ]);

  return NextResponse.json({
    tokens,
    pagination: getPaginationMeta({ page, limit, total }),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request, AdminRole.OWNER);
  if (!authResult.ok) return authResult.response;
  const auth = authResult.auth;

  const body = await request.json();
  const name = String(body.name || '').trim();
  const requestedRole = String(body.role || 'EDITOR').toUpperCase() as AdminRole;
  const requestedTenantId = (body.tenantId ? String(body.tenantId) : null) as string | null;
  const rawToken = String(body.token || '').trim() || generateRawToken();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!Object.values(AdminRole).includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const tenantId = auth.isGlobal ? requestedTenantId : auth.tenantId;
  if (!auth.isGlobal && requestedTenantId && requestedTenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
  }

  const tokenHash = hashToken(rawToken);
  const lastFour = rawToken.slice(-4);

  try {
    const token = await prisma.adminToken.create({
      data: {
        name,
        tokenHash,
        lastFour,
        role: requestedRole,
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        tenantId: true,
        lastFour: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      token,
      rawToken, // shown only at creation time
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create token' },
      { status: 500 }
    );
  }
}
