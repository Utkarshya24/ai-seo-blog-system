import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { toWebsiteSafe } from '@/lib/websites/presenter';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
  if (!authResult.ok) return authResult.response;
  const auth = authResult.auth;
  const { id } = await context.params;

  const body = await request.json();
  const payload = {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    domain: typeof body.domain === 'string' ? body.domain.trim() : undefined,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined,
    niche: typeof body.niche === 'string' ? body.niche.trim() : undefined,
    gscProperty: typeof body.gscProperty === 'string' ? body.gscProperty.trim() : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };

  const website = await prisma.website.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });

  if (!website) {
    return NextResponse.json({ error: 'Website not found' }, { status: 404 });
  }

  if (!auth.isGlobal && auth.tenantId !== website.tenantId) {
    return NextResponse.json({ error: 'Forbidden: website outside tenant scope' }, { status: 403 });
  }

  const updated = await prisma.website.update({
    where: { id },
    data: {
      ...(payload.name && { name: payload.name }),
      ...(payload.domain && { domain: payload.domain }),
      ...(payload.baseUrl && { baseUrl: payload.baseUrl }),
      ...(payload.niche && { niche: payload.niche }),
      ...(payload.gscProperty !== undefined && { gscProperty: payload.gscProperty || null }),
      ...(typeof payload.isActive === 'boolean' && { isActive: payload.isActive }),
    },
  });

  return NextResponse.json({ success: true, website: toWebsiteSafe(updated) });
}
