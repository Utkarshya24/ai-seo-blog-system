# API Documentation

Complete reference for all API endpoints in the AI SEO Blog System. All AI-powered features use Google Gemini API for content generation.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently, no authentication is required. In production, add authentication middleware to sensitive endpoints.

---

## Keywords Endpoints

### Generate Keywords
Generate new SEO keywords for a given niche.

**Endpoint:** `POST /keywords/generate`

**Request Body:**
```json
{
  "niche": "AI tools",
  "count": 5
}
```

**Response:**
```json
{
  "success": true,
  "keywords": [
    {
      "id": "uuid",
      "keyword": "best AI tools for productivity",
      "niche": "AI tools",
      "status": "pending",
      "searchVolume": 1240,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 5
}
```

**Status Codes:**
- 200: Success
- 400: Missing required fields (niche)
- 500: AI generation failed

---

### Get Keywords
Retrieve all keywords with optional filters.

**Endpoint:** `GET /keywords/generate`

**Query Parameters:**
- `status`: Filter by status ('pending', 'used') - optional
- `niche`: Filter by niche - optional

**Example:**
```
GET /keywords/generate?status=pending&niche=AI%20tools
```

**Response:**
```json
{
  "keywords": [
    {
      "id": "uuid",
      "keyword": "best AI tools for productivity",
      "niche": "AI tools",
      "status": "pending",
      "searchVolume": 1240,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 500: Database error

---

## Posts Endpoints

### Generate Blog Post
Create a new blog post from a keyword.

**Endpoint:** `POST /posts/generate`

**Request Body:**
```json
{
  "keywordId": "uuid-of-keyword",
  "title": "The Ultimate Guide to AI Tools",
  "tone": "professional"
}
```

**Parameters:**
- `keywordId`: (required) UUID of the keyword to use
- `title`: (required) Blog post title
- `tone`: (optional) Writing tone - 'professional', 'casual', etc.

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "uuid",
    "title": "The Ultimate Guide to AI Tools",
    "slug": "the-ultimate-guide-to-ai-tools",
    "content": "# The Ultimate Guide to AI Tools\n\n...",
    "metaDescription": "Discover the best AI tools for productivity and efficiency...",
    "status": "draft",
    "readingTime": 5,
    "keywordId": "uuid",
    "publishedAt": null,
    "createdAt": "2024-01-15T10:35:00Z",
    "updatedAt": "2024-01-15T10:35:00Z"
  }
}
```

**Status Codes:**
- 200: Success
- 400: Missing required fields
- 404: Keyword not found
- 500: AI generation failed

---

### Get Posts
Retrieve all posts with optional filters.

**Endpoint:** `GET /posts/generate`

**Query Parameters:**
- `status`: Filter by status ('draft', 'published') - optional
- `keywordId`: Filter by keyword - optional

**Example:**
```
GET /posts/generate?status=draft
```

**Response:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "title": "The Ultimate Guide to AI Tools",
      "slug": "the-ultimate-guide-to-ai-tools",
      "status": "draft",
      "readingTime": 5,
      "keyword": {
        "id": "uuid",
        "keyword": "best AI tools"
      },
      "publishedAt": null,
      "createdAt": "2024-01-15T10:35:00Z"
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 500: Database error

---

### Publish Post
Publish a draft post.

**Endpoint:** `PUT /posts/publish`

**Request Body:**
```json
{
  "postId": "uuid-of-post"
}
```

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "uuid",
    "title": "The Ultimate Guide to AI Tools",
    "slug": "the-ultimate-guide-to-ai-tools",
    "status": "published",
    "publishedAt": "2024-01-15T10:40:00Z",
    "readingTime": 5,
    "keyword": {
      "id": "uuid",
      "keyword": "best AI tools"
    },
    "createdAt": "2024-01-15T10:35:00Z"
  }
}
```

**Status Codes:**
- 200: Success
- 400: Missing postId
- 404: Post not found
- 500: Database error

---

## Metrics Endpoints

### Get Metrics
Retrieve SEO metrics for posts.

**Endpoint:** `GET /metrics`

**Query Parameters:**
- `postId`: Get metrics for a specific post - optional

**Example:**
```
GET /metrics?postId=uuid-of-post
```

**Response (single post):**
```json
{
  "id": "uuid",
  "postId": "uuid",
  "views": 1250,
  "clicks": 85,
  "avgTimeOnPage": 185,
  "bounceRate": 35.2,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T11:45:00Z"
}
```

**Response (all metrics):**
```json
{
  "metrics": [
    {
      "id": "uuid",
      "postId": "uuid",
      "views": 1250,
      "clicks": 85,
      "avgTimeOnPage": 185,
      "bounceRate": 35.2,
      "updatedAt": "2024-01-15T11:45:00Z"
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 404: Metrics not found (when postId specified)
- 500: Database error

---

### Create/Update Metrics
Create new metrics or update existing ones.

**Endpoint:** `POST /metrics`

**Request Body:**
```json
{
  "postId": "uuid-of-post",
  "views": 1250,
  "clicks": 85,
  "avgTimeOnPage": 185,
  "bounceRate": 35.2
}
```

**Parameters:**
- `postId`: (required) UUID of the post
- `views`: (optional, default: 0) Number of page views
- `clicks`: (optional, default: 0) Number of search clicks
- `avgTimeOnPage`: (optional, default: 0) Average time in seconds
- `bounceRate`: (optional, default: 0) Bounce rate percentage

**Response:**
```json
{
  "success": true,
  "metrics": {
    "id": "uuid",
    "postId": "uuid",
    "views": 1250,
    "clicks": 85,
    "avgTimeOnPage": 185,
    "bounceRate": 35.2,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:50:00Z"
  }
}
```

**Status Codes:**
- 200: Success
- 400: Missing postId
- 500: Database error

---

## Cron Endpoints

### Trigger Cron Job (POST)
Manually trigger a cron job using POST request.

**Endpoint:** `POST /cron`

**Request Body:**
```json
{
  "secret": "your-cron-secret",
  "job": "generate-keywords"
}
```

**Job Types:**
- `generate-keywords`: Daily keyword generation
- `generate-blog`: Weekly blog generation
- `update-metrics`: Weekly metrics update

**Response:**
```json
{
  "success": true,
  "message": "Daily keyword generation completed"
}
```

**Status Codes:**
- 200: Success
- 400: Unknown job type
- 401: Invalid secret
- 500: Job execution failed

---

### Trigger Cron Job (GET)
Manually trigger a cron job using GET request (for services like EasyCron).

**Endpoint:** `GET /cron`

**Query Parameters:**
- `secret`: (required) Cron job secret
- `job`: (required) Job type

**Example:**
```
GET /cron?secret=your-cron-secret&job=generate-keywords
```

**Response:**
```json
{
  "success": true,
  "message": "Daily keyword generation completed"
}
```

**Status Codes:**
- 200: Success
- 400: Missing parameters or unknown job type
- 401: Invalid secret
- 500: Job execution failed

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

**Common Error Messages:**
- `"Missing required fields"` - Check request body
- `"Unauthorized"` - Invalid cron secret
- `"Unknown job type"` - Invalid cron job name
- `"Keyword not found"` - Invalid keywordId
- `"Post not found"` - Invalid postId
- `"Failed to generate keywords"` - OpenAI API error
- `"Failed to generate blog post"` - OpenAI API error

---

## Rate Limiting

Currently no rate limiting is implemented. For production, consider adding:
- API key authentication
- Rate limiting middleware
- Request validation
- CORS configuration

---

## Examples

### Complete Workflow

1. **Generate Keywords**
```bash
curl -X POST http://localhost:3000/api/keywords/generate \
  -H "Content-Type: application/json" \
  -d '{"niche": "AI tools", "count": 3}'
```

2. **Generate Blog Post** (use keywordId from above)
```bash
curl -X POST http://localhost:3000/api/posts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "keywordId": "abc123",
    "title": "Best AI Tools for 2024"
  }'
```

3. **Publish Post** (use postId from above)
```bash
curl -X PUT http://localhost:3000/api/posts/publish \
  -H "Content-Type: application/json" \
  -d '{"postId": "xyz789"}'
```

4. **Update Metrics**
```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "xyz789",
    "views": 500,
    "clicks": 25,
    "avgTimeOnPage": 120,
    "bounceRate": 40
  }'
```

---

## SDK Integration

For frontend integration, use the fetch API:

```typescript
// Generate keywords
const keywordsRes = await fetch('/api/keywords/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ niche: 'AI tools', count: 5 })
});
const keywords = await keywordsRes.json();
```

---

## Webhook Integration

To integrate with external services (like EasyCron), use:

```
POST http://your-domain.com/api/cron
Content-Type: application/json

{
  "secret": "your-cron-secret",
  "job": "generate-keywords"
}
```

Or for services that only support GET:

```
http://your-domain.com/api/cron?secret=your-cron-secret&job=generate-keywords
```
