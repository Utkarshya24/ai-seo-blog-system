# Next.js Receiver Route Template (Main Website)

Use this in your **main website** project to receive posts from AI SEO Blog System.

Create file:

`app/api/content-ingest/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Replace this with your real DB/CMS write function
async function upsertArticleInMainSite(input: {
  externalId: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'scheduled';
  publishedAt: Date | null;
  primaryKeyword: string | null;
  sourceUrl: string;
}) {
  // Example:
  // await prisma.article.upsert({ ... })
  // or call your CMS SDK here
  return { ok: true, articleId: input.externalId };
}

const payloadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string().min(1),
  metaDescription: z.string().default(''),
  status: z.enum(['draft', 'published', 'scheduled']),
  publishedAt: z.string().datetime().nullable(),
  keyword: z.string().nullable(),
  source: z.string().url(),
});

const INGEST_SECRET = process.env.CONTENT_INGEST_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const incomingSecret = request.headers.get('x-webhook-secret') || '';
    if (!INGEST_SECRET || incomingSecret !== INGEST_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    const result = await upsertArticleInMainSite({
      externalId: payload.id,
      title: payload.title,
      slug: payload.slug,
      content: payload.content,
      excerpt: payload.metaDescription,
      status: payload.status,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
      primaryKeyword: payload.keyword,
      sourceUrl: payload.source,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[MainSite] content-ingest failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 500 }
    );
  }
}
```

## Env On Main Website

Add to main website `.env`:

```env
CONTENT_INGEST_SECRET="same-value-as-EXTERNAL_PUBLISH_WEBHOOK_SECRET"
```

## Configure Sender (This Project)

In AI SEO Blog System `.env.local`:

```env
EXTERNAL_PUBLISH_WEBHOOK_URL="https://your-main-site.com/api/content-ingest"
EXTERNAL_PUBLISH_WEBHOOK_SECRET="same-value-as-CONTENT_INGEST_SECRET"
```

## Quick Test

From AI SEO system call:

```bash
curl -X POST http://localhost:3000/api/posts/publish-external \
  -H "Content-Type: application/json" \
  -d '{"postId":"YOUR_POST_ID","publishIfDraft":true}'
```
