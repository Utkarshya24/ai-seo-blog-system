import { AdminRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { auth } = authResult;

    const body = await request.json();
    const websiteId = String(body.websiteId || '').trim();

    if (!websiteId) {
      return NextResponse.json({ error: 'websiteId is required' }, { status: 400 });
    }

    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, tenantId: true },
    });

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    if (!auth.isGlobal && auth.tenantId !== website.tenantId) {
      return NextResponse.json({ error: 'Forbidden: website outside tenant scope' }, { status: 403 });
    }

    await prisma.website.update({
      where: { id: websiteId },
      data: {
        gscRefreshTokenEnc: null,
        gscConnectedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect GSC' },
      { status: 500 }
    );
  }
}
