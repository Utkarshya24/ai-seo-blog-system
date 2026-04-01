import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request, AdminRole.OWNER);
  if (!authResult.ok) return authResult.response;
  const auth = authResult.auth;
  const { id } = await context.params;

  const body = await request.json();
  const isActive = Boolean(body.isActive);

  const token = await prisma.adminToken.findUnique({
    where: { id },
    select: { id: true, tenantId: true, name: true, role: true, isActive: true },
  });

  if (!token) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  if (!auth.isGlobal && token.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden: token outside tenant scope' }, { status: 403 });
  }

  const updated = await prisma.adminToken.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      role: true,
      tenantId: true,
      lastFour: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, token: updated });
}
