# API Documentation

Base URL:

```text
http://localhost:3000/api
```

Auth:

- Admin APIs require `x-admin-token` header (or `Authorization: Bearer <token>`).
- Cron jobs still require `CRON_SECRET`.
- Public content APIs can optionally use `CONTENT_API_KEY`.

Tenant context (for multi-website usage) can be passed via:

- `x-tenant-id` header or `tenantId` query param
- `x-website-id` header or `websiteId` query param

## Tenants

### POST `/tenants`

Create a tenant.

### GET `/tenants`

List tenants with active websites.

## Admin Tokens

### GET `/auth/me`

Validate current admin token and return role/scope.

### POST `/auth/tokens`

Create a new admin token (owner-only).

### GET `/auth/tokens`

List existing admin tokens available in current auth scope.

### PATCH `/auth/tokens/[id]`

Activate/deactivate an existing token (owner-only).

## Websites

### POST `/websites`

Create a website under a tenant.

### GET `/websites`

List websites (`tenantId` optional query param).

### PATCH `/websites/[id]`

Update website metadata, including optional `gscProperty`.

### Website GSC OAuth

### POST `/integrations/gsc/connect`

Start Google OAuth for a website and return `authUrl`.

Request:

```json
{
  "websiteId": "cweb..."
}
```

### GET `/integrations/gsc/callback`

OAuth callback endpoint used by Google. It stores encrypted refresh token for the website.

### POST `/integrations/gsc/disconnect`

Remove website-level GSC OAuth credentials.

Request:

```json
{
  "websiteId": "cweb..."
}
```

## Keywords

### POST `/keywords/generate`

Generate keywords using Gemini and upsert them into DB.

Request:

```json
{
  "niche": "AI tools",
  "count": 5,
  "mode": "mixed"
}
```

`mode` options:

- `mixed` (default): standard + comparison intent
- `standard`: only standard long-tail keywords
- `comparison`: strict `X vs Y` comparison keywords

Response:

```json
{
  "success": true,
  "keywords": [
    {
      "id": "ckw...",
      "keyword": "best ai tools for teams",
      "niche": "ai tools",
      "difficulty": 42,
      "searchVolume": 1200,
      "generatedAt": "2026-03-31T12:00:00.000Z",
      "updatedAt": "2026-03-31T12:00:00.000Z",
      "status": "pending",
      "intent": "comparison",
      "priorityScore": 78.5,
      "createdAt": "2026-03-31T12:00:00.000Z"
    }
  ],
  "count": 5
}
```

Status codes:

- `200` success
- `400` missing `niche`
- `500` generation or DB error

### GET `/keywords/generate`

Get keywords.

Supported query params:

- `status`: `pending | used` (derived from keyword-post relation)
- `niche`: filter by stored niche
- `q`: keyword text search
- `minDifficulty`: number
- `maxDifficulty`: number

Example:

```text
GET /keywords/generate?status=pending&q=ai
```

Response:

```json
{
  "keywords": [
    {
      "id": "ckw...",
      "keyword": "best ai tools for teams",
      "niche": "ai tools",
      "difficulty": 42,
      "searchVolume": 1200,
      "generatedAt": "2026-03-31T12:00:00.000Z",
      "updatedAt": "2026-03-31T12:00:00.000Z",
      "status": "pending",
      "createdAt": "2026-03-31T12:00:00.000Z"
    }
  ]
}
```

## Posts

### POST `/posts/generate`

Generate a draft post from a keyword.

Request:

```json
{
  "keywordId": "ckw...",
  "title": "The Ultimate Guide to AI Tools",
  "tone": "professional"
}
```

Response:

```json
{
  "success": true,
  "post": {
    "id": "cpo...",
    "keywordId": "ckw...",
    "title": "The Ultimate Guide to AI Tools",
    "slug": "the-ultimate-guide-to-ai-tools",
    "content": "# The Ultimate Guide to AI Tools\n\n...",
    "metaDescription": "A concise SEO description...",
    "status": "draft",
    "publishedAt": null,
    "createdAt": "2026-03-31T12:05:00.000Z",
    "updatedAt": "2026-03-31T12:05:00.000Z",
    "keyword": {
      "id": "ckw...",
      "keyword": "best ai tools for teams",
      "difficulty": 42,
      "searchVolume": 1200,
      "generatedAt": "2026-03-31T12:00:00.000Z",
      "updatedAt": "2026-03-31T12:00:00.000Z"
    },
    "readingTime": 5
  }
}
```

Status codes:

- `200` success
- `400` missing `keywordId` or `title`, or title above 60 chars (auto-trimmed in backend)
- `404` keyword not found
- `500` generation or DB error

### GET `/posts/generate`

Get posts.

Query params:

- `status`: `draft | published | scheduled`
- `keywordId`

Example:

```text
GET /posts/generate?status=published
```

Response:

```json
{
  "posts": [
    {
      "id": "cpo...",
      "keywordId": "ckw...",
      "title": "The Ultimate Guide to AI Tools",
      "slug": "the-ultimate-guide-to-ai-tools",
      "content": "# The Ultimate Guide to AI Tools\n\n...",
      "metaDescription": "A concise SEO description...",
      "status": "published",
      "publishedAt": "2026-03-31T12:10:00.000Z",
      "createdAt": "2026-03-31T12:05:00.000Z",
      "updatedAt": "2026-03-31T12:10:00.000Z",
      "keyword": {
        "id": "ckw...",
        "keyword": "best ai tools for teams",
        "difficulty": 42,
        "searchVolume": 1200,
        "generatedAt": "2026-03-31T12:00:00.000Z",
        "updatedAt": "2026-03-31T12:00:00.000Z"
      },
      "readingTime": 5
    }
  ]
}
```

### PUT `/posts/publish`

Publish a post.

Request:

```json
{
  "postId": "cpo..."
}
```

### POST `/posts/optimize-serp`

AI-powered title/meta optimization for CTR improvement.

Request:

```json
{
  "postId": "cpo..."
}
```

### POST `/posts/auto-internal-link`

Automatically inserts contextual internal links into a post content body.

Request:

```json
{
  "postId": "cpo...",
  "maxLinks": 3
}
```

Response:

```json
{
  "success": true,
  "updated": true,
  "insertedLinks": [
    {
      "postId": "cpo2...",
      "slug": "related-post",
      "anchorText": "related topic"
    }
  ],
  "post": {
    "id": "cpo...",
    "title": "Current Post",
    "slug": "current-post"
  }
}
```

Response:

```json
{
  "success": true,
  "post": {
    "id": "cpo...",
    "title": "Improved SEO Title",
    "metaDescription": "Updated CTR-focused description..."
  },
  "optimization": {
    "reasoning": "Updated for stronger SERP clarity and intent match."
  }
}
```

Response:

```json
{
  "success": true,
  "post": {
    "id": "cpo...",
    "status": "published",
    "publishedAt": "2026-03-31T12:10:00.000Z"
  }
}
```

### POST `/posts/publish-external`

Push post content to an external CMS/site webhook. Draft posts can be auto-published before push.

Request:

```json
{
  "postId": "cpo...",
  "webhookUrl": "https://example.com/api/content-ingest",
  "publishIfDraft": true
}
```

Notes:

- `webhookUrl` is optional if `EXTERNAL_PUBLISH_WEBHOOK_URL` is set.
- Secret header `x-webhook-secret` is sent when `EXTERNAL_PUBLISH_WEBHOOK_SECRET` exists.

Response:

```json
{
  "success": true,
  "post": {
    "id": "cpo...",
    "status": "published"
  },
  "targetWebhook": "https://example.com/api/content-ingest",
  "externalStatus": 200,
  "externalResponse": "ok"
}
```

Receiver-side implementation template is available at:

- `templates/nextjs-receiver-route.md`

## Public Content APIs (Pull Integration)

Use these when another project needs to fetch published posts from this system.

### GET `/public/posts`

Query params:

- `page` (default `1`)
- `limit` (default `20`, max `100`)
- `niche` (optional)
- `q` (optional search)
- `includeContent=true` (optional)
- `apiKey` (optional if `CONTENT_API_KEY` env is set)

Response:

```json
{
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1,
  "posts": [
    {
      "id": "cpo...",
      "title": "The Ultimate Guide to AI Tools",
      "slug": "the-ultimate-guide-to-ai-tools",
      "metaDescription": "A concise SEO description...",
      "status": "published",
      "publishedAt": "2026-03-31T12:10:00.000Z",
      "createdAt": "2026-03-31T12:05:00.000Z",
      "updatedAt": "2026-03-31T12:10:00.000Z",
      "readingTime": 5,
      "niche": "ai tools",
      "keyword": "best ai tools for teams"
    }
  ]
}
```

### GET `/public/posts/[slug]`

Response:

```json
{
  "id": "cpo...",
  "title": "The Ultimate Guide to AI Tools",
  "slug": "the-ultimate-guide-to-ai-tools",
  "content": "# The Ultimate Guide to AI Tools\n\n...",
  "metaDescription": "A concise SEO description...",
  "status": "published",
  "publishedAt": "2026-03-31T12:10:00.000Z",
  "createdAt": "2026-03-31T12:05:00.000Z",
  "updatedAt": "2026-03-31T12:10:00.000Z",
  "readingTime": 5,
  "niche": "ai tools",
  "keyword": "best ai tools for teams"
}
```

## Metrics

### GET `/metrics`

Get SEO metrics.

Query params:

- `postId` optional

Response shape includes native DB fields and compatibility fields used by current admin UI.

Single response example:

```json
{
  "id": "cmet...",
  "postId": "cpo...",
  "backlinks": 12,
  "traffic": 1300,
  "impressions": 1300,
  "clicks": 65,
  "ctr": 5,
  "ranking": 18,
  "position": 18.2,
  "source": "gsc",
  "fetchedAt": "2026-03-31T12:20:00.000Z",
  "updatedAt": "2026-03-31T12:20:00.000Z",
  "views": 1300,
  "clicks": 65,
  "avgTimeOnPage": 324,
  "bounceRate": 68.8,
  "createdAt": "2026-03-31T12:20:00.000Z"
}
```

### POST `/metrics`

Upsert metrics for a post.

Supports either native fields or compatibility fields.

Request (compatibility style):

```json
{
  "postId": "cpo...",
  "views": 1300,
  "clicks": 65
}
```

## SEO Opportunities

### GET `/seo/opportunities`

Returns ranked list of low-CTR, high-impression posts with estimated click upside.

### GET `/posts/internal-link-opportunities`

Returns related-post suggestions for internal linking.

Query params:
- `postId` (required)

## SERP A/B Experiments

### GET `/experiments/serp`

List SERP experiments (optionally filter by `postId` or `status`).

### POST `/experiments/serp`

Start new SERP experiment for a post.

Request:

```json
{
  "postId": "cpo..."
}
```

### PATCH `/experiments/serp/[id]`

Two actions are supported:

1. Record variant data

```json
{
  "action": "record",
  "impressionsA": 500,
  "clicksA": 15,
  "impressionsB": 520,
  "clicksB": 24
}
```

2. Select winner and apply it to post metadata

```json
{
  "action": "select-winner",
  "minImpressionsEach": 50,
  "applyWinner": true
}
```

## AI Visibility Tracker

### GET `/ai-visibility/mentions`

List AI mention records in current tenant/website scope.

Query params:
- `days` (default `30`)
- `provider` (optional)
- `q` (optional query text filter)

### POST `/ai-visibility/mentions`

Ingest mentions (single or batch).

Request:

```json
{
  "mentions": [
    {
      "provider": "CHATGPT",
      "query": "best ai seo tools",
      "citedUrl": "https://example.com/blog/seo-guide",
      "sourceUrl": "https://chat.openai.com/...",
      "rank": 1,
      "snippet": "Example citation snippet..."
    }
  ]
}
```

## Backlink Outreach CRM

### GET `/outreach/opportunities`

List outreach opportunities for active tenant/website.

Query params:
- `status` (optional)
- `q` (optional search)

### POST `/outreach/opportunities`

Create outreach opportunity.

Request example:

```json
{
  "targetDomain": "example.com",
  "targetUrl": "https://example.com/write-for-us",
  "contactName": "Jane Doe",
  "contactEmail": "jane@example.com",
  "status": "PROSPECT",
  "relevanceScore": 72,
  "authorityScore": 58,
  "expectedLink": "https://your-site.com/blog/target",
  "nextFollowUpAt": "2026-04-07",
  "notes": "Fits SaaS audience. Send pitch with stats."
}
```

### PATCH `/outreach/opportunities/[id]`

Update status/details for an opportunity.

Request example:

```json
{
  "status": "CONTACTED",
  "notes": "Intro email sent. Waiting reply."
}
```

## Social SEO Draft Generator

### POST `/social/generate`

Generate LinkedIn and Twitter(X) drafts for a published blog post.

Request:

```json
{
  "postId": "cpo..."
}
```

Response:

```json
{
  "success": true,
  "drafts": {
    "linkedin": {
      "id": "csd...",
      "platform": "LINKEDIN",
      "content": "Long-form LinkedIn post...",
      "hashtags": "#seo #contentmarketing #ai",
      "callToAction": "Read and share your thoughts."
    },
    "x": {
      "id": "csd...",
      "platform": "X",
      "content": "Short X post...",
      "hashtags": "#seo #ai",
      "callToAction": "Read now."
    }
  }
}
```

### GET `/social/generate`

Fetch recent generated social drafts for a post.

Query params:
- `postId` (required)

### GET `/ai-visibility/summary`

Returns citation share summary in selected window.

Response example:

```json
{
  "windowDays": 30,
  "totalMentions": 120,
  "citedMentions": 24,
  "citationRate": 20,
  "targetHost": "example.com",
  "providerBreakdown": {
    "CHATGPT": 70,
    "PERPLEXITY": 50
  },
  "topQueries": [
    { "query": "best ai seo tools", "count": 18 }
  ]
}
```

Request (native style):

```json
{
  "postId": "cpo...",
  "impressions": 1300,
  "clicks": 65,
  "ctr": 5,
  "traffic": 1300,
  "backlinks": 12,
  "ranking": 18,
  "position": 18.2,
  "source": "manual"
}
```

Response:

```json
{
  "success": true,
  "metrics": {
    "id": "cmet...",
    "postId": "cpo...",
    "backlinks": 12,
    "traffic": 1300,
    "ranking": 18,
    "fetchedAt": "2026-03-31T12:20:00.000Z",
    "updatedAt": "2026-03-31T12:20:00.000Z",
    "views": 1300,
    "clicks": 65,
    "avgTimeOnPage": 324,
    "bounceRate": 68.8,
    "createdAt": "2026-03-31T12:20:00.000Z"
  }
}
```

### POST `/metrics/gsc`

Sync real performance metrics from Google Search Console.

Request:

```json
{
  "secret": "your-cron-secret",
  "siteUrl": "sc-domain:example.com",
  "startDate": "2026-03-24",
  "endDate": "2026-03-31",
  "rowLimit": 1000
}
```

Notes:

- `secret` must match `CRON_SECRET`.
- Access token resolution priority:
1. `accessToken` from request body
2. `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN` env
3. website OAuth refresh token (if website connected via GSC OAuth)
- `siteUrl` resolution priority:
1. `siteUrl` from request body
2. website `gscProperty`
3. `GSC_SITE_URL` env
- If dates are omitted, backend uses last 7 full days.

Response:

```json
{
  "success": true,
  "siteUrl": "sc-domain:example.com",
  "range": {
    "startDate": "2026-03-24",
    "endDate": "2026-03-31"
  },
  "totalRows": 312,
  "matchedPosts": 42,
  "updatedPosts": 40
}
```

## Cron

### POST `/cron`

Run a job manually.

Request:

```json
{
  "secret": "your-cron-secret",
  "job": "generate-keywords"
}
```

Jobs:

- `generate-keywords`
- `generate-blog`
- `update-metrics`
- `refresh-content` (AI refresh for declining published posts)

### GET `/cron`

Same behavior via query string:

```text
/cron?secret=your-cron-secret&job=generate-keywords
```

## Error Format

```json
{
  "error": "Description"
}
```
