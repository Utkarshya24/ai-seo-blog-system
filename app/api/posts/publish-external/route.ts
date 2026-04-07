import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { publishToExternalWebhook } from '@/lib/integrations/external-publisher';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';

const DEFAULT_WEBHOOK_URL = process.env.EXTERNAL_PUBLISH_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.EXTERNAL_PUBLISH_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function validateWebhookUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  const url = rawUrl.trim();
  if (!url) {
    return { ok: false, error: 'Webhook URL cannot be empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'Webhook URL is not a valid URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Webhook URL must use http or https.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'example.com' || host.endsWith('.example.com')) {
    return {
      ok: false,
      error:
        'Webhook URL points to example.com placeholder. Set a real ingestion endpoint (for example: https://your-domain.com/api/content-ingest).',
    };
  }

  return { ok: true, url: parsed.toString() };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const {
      postId,
      webhookUrl,
      publishIfDraft = true,
    }: {
      postId?: string;
      webhookUrl?: string;
      publishIfDraft?: boolean;
    } = body;

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    let post = await prisma.post.findUnique({
      where: { id: postId },
      include: { keyword: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (tenantId && post.tenantId && post.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Post does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && post.websiteId && post.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Post does not belong to website' }, { status: 403 });
    }

    const website = post.websiteId
      ? await prisma.website.findUnique({
          where: { id: post.websiteId },
          select: { externalWebhookUrl: true },
        })
      : null;
    const rawTargetWebhook = webhookUrl || website?.externalWebhookUrl || DEFAULT_WEBHOOK_URL;
    if (!rawTargetWebhook) {
      return NextResponse.json(
        {
          error:
            'No webhook URL configured. Save website webhook URL, set EXTERNAL_PUBLISH_WEBHOOK_URL, or pass webhookUrl in request.',
        },
        { status: 400 }
      );
    }
    const webhookValidation = validateWebhookUrl(rawTargetWebhook);
    if (!webhookValidation.ok) {
      return NextResponse.json({ error: webhookValidation.error }, { status: 400 });
    }
    const targetWebhook = webhookValidation.url;

    if (publishIfDraft && post.status === 'draft') {
      post = await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'published',
          publishedAt: new Date(),
        },
        include: { keyword: true },
      });
    }

    const payload = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      metaDescription: post.metaDescription,
      status: post.status,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      keyword: post.keyword?.keyword ?? null,
      source: `${APP_URL}/blog/${post.slug}`,
    };

    const externalResult = await publishToExternalWebhook(targetWebhook, payload, WEBHOOK_SECRET);

    if (!externalResult.ok) {
      return NextResponse.json(
        {
          error: `External publish failed with status ${externalResult.status}`,
          externalStatus: externalResult.status,
          externalResponse: externalResult.responseText,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      post,
      targetWebhook,
      externalStatus: externalResult.status,
      externalResponse: externalResult.responseText,
    });
  } catch (error) {
    console.error('[API] External publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish externally' },
      { status: 500 }
    );
  }
}
