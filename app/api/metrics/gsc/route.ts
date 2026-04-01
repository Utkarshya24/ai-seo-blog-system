import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { syncSearchConsoleMetrics } from '@/lib/integrations/google-search-console';
import { refreshAccessToken } from '@/lib/integrations/google-oauth';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { prisma } from '@/lib/db';
import { decryptText } from '@/lib/security/crypto';
import { resolveTenantContext } from '@/lib/tenant-context';

function dateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const secret = body.secret as string | undefined;
    const siteUrlFromBody = (body.siteUrl as string | undefined)?.trim();
    const startDate = (body.startDate as string | undefined) || dateNDaysAgo(7);
    const endDate = (body.endDate as string | undefined) || dateNDaysAgo(1);
    const rowLimit = Number(body.rowLimit || 1000);
    let siteUrl = siteUrlFromBody || process.env.GSC_SITE_URL;
    let accessToken = (body.accessToken as string | undefined) || process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((!siteUrl || !accessToken) && websiteId) {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
        select: {
          id: true,
          gscProperty: true,
          gscRefreshTokenEnc: true,
        },
      });

      if (website?.gscProperty && !siteUrl) {
        siteUrl = website.gscProperty;
      }

      if (website?.gscRefreshTokenEnc && !accessToken) {
        const refreshToken = decryptText(website.gscRefreshTokenEnc);
        accessToken = await refreshAccessToken(refreshToken);
      }
    }

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'siteUrl is required (set website gscProperty or GSC_SITE_URL).' },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            'accessToken is required (set website GSC connection or GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN).',
        },
        { status: 400 }
      );
    }

    const result = await syncSearchConsoleMetrics({
      siteUrl,
      startDate,
      endDate,
      accessToken,
      rowLimit,
      tenantId,
      websiteId,
    });

    return NextResponse.json({
      success: true,
      siteUrl,
      range: { startDate, endDate },
      ...result,
    });
  } catch (error) {
    console.error('[GSC Sync] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GSC sync failed' },
      { status: 500 }
    );
  }
}
