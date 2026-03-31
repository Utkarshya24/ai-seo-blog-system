# API Documentation

Base URL:

```text
http://localhost:3000/api
```

No auth is enabled except cron secret validation on `/cron`.

## Keywords

### POST `/keywords/generate`

Generate keywords using Gemini and upsert them into DB.

Request:

```json
{
  "niche": "AI tools",
  "count": 5
}
```

Response:

```json
{
  "success": true,
  "keywords": [
    {
      "id": "ckw...",
      "keyword": "best ai tools for teams",
      "difficulty": 42,
      "searchVolume": 1200,
      "generatedAt": "2026-03-31T12:00:00.000Z",
      "updatedAt": "2026-03-31T12:00:00.000Z",
      "niche": "general",
      "status": "pending",
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
- `niche`: compatibility filter; mapped to keyword text match
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
      "difficulty": 42,
      "searchVolume": 1200,
      "generatedAt": "2026-03-31T12:00:00.000Z",
      "updatedAt": "2026-03-31T12:00:00.000Z",
      "niche": "general",
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
- `400` missing `keywordId` or `title`
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
  "ranking": 18,
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

Request (native style):

```json
{
  "postId": "cpo...",
  "traffic": 1300,
  "backlinks": 12,
  "ranking": 18
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
