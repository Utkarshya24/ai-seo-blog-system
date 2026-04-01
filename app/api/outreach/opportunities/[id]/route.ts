import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, OutreachStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { clampScore, parseStatus } from '@/lib/outreach/utils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { id } = await context.params;
    const body = await request.json();

    const row = await prisma.outreachOpportunity.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    if (tenantId && row.tenantId && row.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Opportunity does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && row.websiteId && row.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Opportunity does not belong to website' }, { status: 403 });
    }

    const nextStatus = parseStatus(body.status ? String(body.status) : undefined) || undefined;
    const updates: Parameters<typeof prisma.outreachOpportunity.update>[0]['data'] = {
      ...(typeof body.targetUrl === 'string' ? { targetUrl: body.targetUrl.trim() || null } : {}),
      ...(typeof body.contactName === 'string' ? { contactName: body.contactName.trim() || null } : {}),
      ...(typeof body.contactEmail === 'string' ? { contactEmail: body.contactEmail.trim() || null } : {}),
      ...(typeof body.contactSocial === 'string' ? { contactSocial: body.contactSocial.trim() || null } : {}),
      ...(typeof body.expectedLink === 'string' ? { expectedLink: body.expectedLink.trim() || null } : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
      ...(typeof body.relevanceScore !== 'undefined' ? { relevanceScore: clampScore(Number(body.relevanceScore)) } : {}),
      ...(typeof body.authorityScore !== 'undefined' ? { authorityScore: clampScore(Number(body.authorityScore)) } : {}),
      ...(typeof body.nextFollowUpAt !== 'undefined'
        ? { nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null }
        : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
    };

    if (nextStatus && nextStatus !== row.status) {
      if (nextStatus === OutreachStatus.CONTACTED || nextStatus === OutreachStatus.FOLLOW_UP) {
        updates.lastContactedAt = new Date();
      }
      if (nextStatus === OutreachStatus.LIVE) {
        updates.wonAt = new Date();
      }
    }

    const updated = await prisma.outreachOpportunity.update({
      where: { id: row.id },
      data: updates,
    });

    return NextResponse.json({ success: true, opportunity: updated });
  } catch (error) {
    console.error('[Outreach] PATCH opportunity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update outreach opportunity' },
      { status: 500 }
    );
  }
}
