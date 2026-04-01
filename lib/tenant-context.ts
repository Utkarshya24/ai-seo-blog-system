import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import type { AdminAuth } from '@/lib/auth/admin-auth';

export interface TenantContext {
  tenantId: string | null;
  websiteId: string | null;
}

export async function resolveTenantContext(
  request: NextRequest,
  auth?: AdminAuth
): Promise<TenantContext> {
  const url = new URL(request.url);
  const explicitTenantId = request.headers.get('x-tenant-id') || url.searchParams.get('tenantId');
  const explicitWebsiteId = request.headers.get('x-website-id') || url.searchParams.get('websiteId');

  if (auth && !auth.isGlobal) {
    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new Error('Authenticated token is not linked to a tenant');
    }

    if (explicitTenantId && explicitTenantId !== tenantId) {
      throw new Error('Tenant mismatch: token tenant and request tenant differ');
    }

    if (explicitWebsiteId) {
      const website = await prisma.website.findUnique({
        where: { id: explicitWebsiteId },
        select: { id: true, tenantId: true },
      });
      if (!website || website.tenantId !== tenantId) {
        throw new Error('Requested website is outside token tenant scope');
      }
      return { tenantId, websiteId: website.id };
    }

    const fallbackWebsite = await prisma.website.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    return { tenantId, websiteId: fallbackWebsite?.id || null };
  }

  if (explicitWebsiteId) {
    const website = await prisma.website.findUnique({
      where: { id: explicitWebsiteId },
      select: { id: true, tenantId: true },
    });

    if (website) {
      if (explicitTenantId && explicitTenantId !== website.tenantId) {
        throw new Error('websiteId does not belong to the provided tenantId');
      }
      return { tenantId: website.tenantId, websiteId: website.id };
    }
  }

  if (explicitTenantId) {
    const fallbackWebsite = await prisma.website.findFirst({
      where: { tenantId: explicitTenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    return {
      tenantId: explicitTenantId,
      websiteId: explicitWebsiteId || fallbackWebsite?.id || null,
    };
  }

  // Backward-compatible default: first active website if none provided.
  const defaultWebsite = await prisma.website.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, tenantId: true },
  });

  if (!defaultWebsite) {
    return { tenantId: null, websiteId: null };
  }

  return {
    tenantId: defaultWebsite.tenantId,
    websiteId: defaultWebsite.id,
  };
}
