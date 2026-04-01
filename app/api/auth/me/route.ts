import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/admin-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.ok) return authResult.response;

  return NextResponse.json({
    authenticated: true,
    role: authResult.auth.role,
    tenantId: authResult.auth.tenantId,
    isGlobal: authResult.auth.isGlobal,
    tokenName: authResult.auth.tokenName || null,
    tokenId: authResult.auth.tokenId || null,
  });
}
