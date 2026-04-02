import { NextRequest, NextResponse } from 'next/server';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { generateGeminiImage } from '@/lib/ai/gemini-image';

type ImageVariant = 'banner' | 'social';

function buildPrompt(params: {
  title: string;
  keyword: string;
  metaDescription: string;
  variant: ImageVariant;
}) {
  const { title, keyword, metaDescription, variant } = params;
  const variantInstruction =
    variant === 'banner'
      ? 'Create a clean blog banner composition with strong headline space and editorial style.'
      : 'Create a social media post visual with high contrast, bold layout, and mobile readability.';

  return `
${variantInstruction}
Topic: ${title}
Primary keyword: ${keyword}
Context: ${metaDescription}
Style: modern, professional, no logos, no watermarks, no text artifacts, visually clear.
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;
    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const body = await request.json();
    const postId = String(body.postId || '').trim();
    const variant = (String(body.variant || 'banner').trim().toLowerCase() as ImageVariant);
    const customPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    if (variant !== 'banner' && variant !== 'social') {
      return NextResponse.json({ error: "variant must be 'banner' or 'social'" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        keyword: true,
      },
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

    const prompt =
      customPrompt ||
      buildPrompt({
        title: post.title,
        keyword: post.keyword?.keyword || post.title,
        metaDescription: post.metaDescription,
        variant,
      });

    const isBanner = variant === 'banner';
    const width = isBanner ? 1536 : 1080;
    const height = isBanner ? 864 : 1080;
    const imageDataUrl = await generateGeminiImage({
      prompt,
      width,
      height,
    });

    return NextResponse.json({
      success: true,
      variant,
      prompt,
      provider: 'gemini',
      images: [imageDataUrl],
    });
  } catch (error) {
    console.error('[Image] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}
