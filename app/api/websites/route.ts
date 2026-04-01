import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { toWebsiteSafe } from '@/lib/websites/presenter';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;
    const { auth } = authResult;

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    if (!auth.isGlobal && auth.tenantId && tenantId && tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    }
    const effectiveTenantId = auth.isGlobal ? tenantId : auth.tenantId || tenantId;

    const websites = await prisma.website.findMany({
      where: {
        ...(effectiveTenantId && { tenantId: effectiveTenantId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ websites: websites.map(toWebsiteSafe) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch websites' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.OWNER);
    if (!authResult.ok) return authResult.response;
    const { auth } = authResult;

    const body = await request.json();
    const requestedTenantId = String(body.tenantId || '').trim();
    const tenantId = auth.isGlobal ? requestedTenantId : auth.tenantId || '';
    const name = String(body.name || '').trim();
    const domain = String(body.domain || '').trim();
    const baseUrl = String(body.baseUrl || '').trim();
    const niche = String(body.niche || 'general').trim();

    if (!tenantId || !name || !domain || !baseUrl) {
      return NextResponse.json(
        { error: 'tenantId, name, domain, and baseUrl are required' },
        { status: 400 }
      );
    }
    if (!auth.isGlobal && requestedTenantId && requestedTenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'Forbidden: tenant mismatch' }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const website = await prisma.website.create({
      data: {
        tenantId,
        name,
        domain,
        baseUrl,
        niche,
      },
    });

    return NextResponse.json({ success: true, website: toWebsiteSafe(website) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create website' },
      { status: 500 }
    );
  }
}
