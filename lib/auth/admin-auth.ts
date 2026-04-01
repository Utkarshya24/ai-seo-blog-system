import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface AdminAuth {
  role: AdminRole;
  tenantId: string | null;
  isGlobal: boolean;
  tokenId?: string;
  tokenName?: string;
}

function roleRank(role: AdminRole): number {
  if (role === AdminRole.OWNER) return 3;
  if (role === AdminRole.EDITOR) return 2;
  return 1;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readRawToken(request: NextRequest): string | null {
  const headerToken = request.headers.get('x-admin-token');
  if (headerToken) return headerToken.trim();

  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

async function resolveAdminAuth(request: NextRequest): Promise<AdminAuth | null> {
  const rawToken = readRawToken(request);
  if (!rawToken) return null;

  const globalToken = process.env.ADMIN_API_TOKEN?.trim();
  if (globalToken && rawToken === globalToken) {
    return {
      role: AdminRole.OWNER,
      tenantId: null,
      isGlobal: true,
      tokenName: 'Global Admin Token',
    };
  }

  const tokenHash = hashToken(rawToken);
  const token = await prisma.adminToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      name: true,
      role: true,
      tenantId: true,
      isActive: true,
    },
  });

  if (!token || !token.isActive) return null;

  return {
    role: token.role,
    tenantId: token.tenantId,
    isGlobal: !token.tenantId,
    tokenId: token.id,
    tokenName: token.name,
  };
}

export async function requireAdminAuth(
  request: NextRequest,
  minimumRole: AdminRole = AdminRole.VIEWER
): Promise<{ ok: true; auth: AdminAuth } | { ok: false; response: NextResponse }> {
  const auth = await resolveAdminAuth(request);

  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: missing or invalid admin token' },
        { status: 401 }
      ),
    };
  }

  if (roleRank(auth.role) < roleRank(minimumRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Forbidden: ${minimumRole} role required` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, auth };
}
