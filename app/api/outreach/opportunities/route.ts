import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, OutreachStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { clampScore, normalizeDomain, parseStatus } from '@/lib/outreach/utils';
import { getPaginationMeta, getPaginationParams } from '@/lib/api/pagination';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.VIEWER);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { searchParams } = new URL(request.url);
    const status = parseStatus(searchParams.get('status'));
    const q = searchParams.get('q') || undefined;
    const { page, limit, skip } = getPaginationParams(request);
    const where = {
      ...(tenantId && { tenantId }),
      ...(websiteId && { websiteId }),
      ...(status && { status }),
      ...(q && {
        OR: [
          { targetDomain: { contains: q, mode: 'insensitive' as const } },
          { contactName: { contains: q, mode: 'insensitive' as const } },
          { notes: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.outreachOpportunity.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.outreachOpportunity.count({ where }),
    ]);

    const summary = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      opportunities: rows,
      summary,
      pagination: getPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error('[Outreach] GET opportunities error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch outreach opportunities' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();

    const targetDomain = normalizeDomain(String(body.targetDomain || ''));
    if (!targetDomain) {
      return NextResponse.json({ error: 'targetDomain is required' }, { status: 400 });
    }

    const status = parseStatus(String(body.status || 'PROSPECT')) || OutreachStatus.PROSPECT;
    const relevanceScore = clampScore(Number(body.relevanceScore || 0));
    const authorityScore = clampScore(Number(body.authorityScore || 0));

    const row = await prisma.outreachOpportunity.create({
      data: {
        tenantId,
        websiteId,
        targetDomain,
        targetUrl: body.targetUrl ? String(body.targetUrl).trim() : null,
        contactName: body.contactName ? String(body.contactName).trim() : null,
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        contactSocial: body.contactSocial ? String(body.contactSocial).trim() : null,
        status,
        relevanceScore,
        authorityScore,
        expectedLink: body.expectedLink ? String(body.expectedLink).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
      },
    });

    return NextResponse.json({ success: true, opportunity: row });
  } catch (error) {
    console.error('[Outreach] POST opportunity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create outreach opportunity' },
      { status: 500 }
    );
  }
}
