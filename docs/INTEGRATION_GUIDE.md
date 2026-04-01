# Universal Integration Guide

This guide explains how user websites connect with the SEO system, how blogs get published, and which integration model to choose.

## 1) Before Integration

1. Create tenant and website in `/admin/websites`.
2. Ensure posts are generated and published in the selected workspace.
3. Decide content delivery model: Pull, Push, or Hybrid.

## 2) Pattern A: Pull Content (Recommended)

Your website fetches published content from this system.

### APIs

- `GET /api/public/posts` (listing)
- `GET /api/public/posts/[slug]` (single post)

### Query Parameters (`/api/public/posts`)

- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `niche` (optional)
- `q` (optional search)
- `includeContent=true` (optional)
- `apiKey` (required only if `CONTENT_API_KEY` is enabled)

### Example

```bash
curl "https://your-seo-system.com/api/public/posts?limit=10&includeContent=true"
```

### For Next.js Main Site

1. Fetch slugs via list endpoint in `generateStaticParams()`.
2. Fetch detail by slug in page server component.
3. Rebuild/redeploy after publish for instant visibility.

## 3) Pattern B: Push Content (Webhook)

This system pushes blog data to your website endpoint.

### Sender API

- `POST /api/posts/publish-external`

### Receiver Template

- `templates/nextjs-receiver-route.md`

### Request Example

```json
{
  "postId": "POST_ID",
  "webhookUrl": "https://main-site.com/api/content-ingest",
  "publishIfDraft": true
}
```

Use this pattern if your site already has ingestion pipeline or CMS sync jobs.

## 4) Pattern C: Hybrid (Best for Scale)

1. Pull APIs for rendering.
2. Push webhook for event notifications/deploy hooks.

This gives both reliability and fresh updates.

## 5) Multi-Website Routing

When using admin APIs, pass workspace context:

- `x-tenant-id`
- `x-website-id`

Without proper scope, you may publish/fetch from wrong website context.

## 6) Security Recommendations

1. Enable `CONTENT_API_KEY` on public APIs.
2. Use `EXTERNAL_PUBLISH_WEBHOOK_SECRET` and verify `x-webhook-secret` in receiver.
3. Keep admin tokens role-limited and rotate regularly.

## 7) Published Data Contract

```json
{
  "id": "post_id",
  "title": "Post title",
  "slug": "post-slug",
  "content": "full content",
  "metaDescription": "seo description",
  "status": "published",
  "publishedAt": "2026-04-01T00:00:00.000Z",
  "niche": "ai tools",
  "keyword": "best ai tools",
  "readingTime": 5
}
```

## 8) Which Pattern to Choose?

1. Static-only website: Pull
2. CMS-style backend website: Push
3. Enterprise teams with deploy automation: Hybrid
