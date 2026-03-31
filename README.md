# AI SEO Blog System

A Next.js + Prisma blog system that generates SEO content with Google Gemini, publishes posts, and tracks SEO metrics.

## Stack

- Next.js 16 (App Router)
- Prisma + PostgreSQL (Neon compatible)
- Google Gemini (`@google/generative-ai`)
- Tailwind CSS + shadcn/ui
- `node-cron` (triggered via API endpoints)

## Features

- AI keyword generation by niche prompt
- AI blog generation from keywords
- Draft/publish post workflow
- Public blog listing and detail pages
- SEO metrics API + admin metrics dashboard
- Manual cron job triggering via `/api/cron`

## Environment

Copy env file:

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, comma-separated priority list; default: `gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-3-flash,gemini-2.5-flash`)
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Install and Run

Using pnpm:

```bash
pnpm install
pnpm prisma db push
pnpm prisma generate
pnpm dev
```

Using npm:

```bash
npm install
npx prisma db push
npx prisma generate
npm run dev
```

App runs at `http://localhost:3000`.

## Project Structure

```text
app/
  api/
    keywords/generate/route.ts
    posts/generate/route.ts
    posts/publish/route.ts
    metrics/route.ts
    cron/route.ts
  admin/
  blog/
lib/
  ai/openai-service.ts
  cron/cron-service.ts
  utils/seo.ts
  db.ts
prisma/schema.prisma
```

## API Summary

- `POST /api/keywords/generate`
- `GET /api/keywords/generate`
- `POST /api/posts/generate`
- `GET /api/posts/generate`
- `PUT /api/posts/publish`
- `GET /api/metrics`
- `POST /api/metrics`
- `GET /api/cron`
- `POST /api/cron`

Detailed examples: see `API.md`.

## Current Database Schema

### `Keyword`

- `id` (cuid)
- `keyword` (unique)
- `difficulty` (0-100)
- `searchVolume`
- `generatedAt`
- `updatedAt`
- Relation: one keyword to many posts

### `Post`

- `id` (cuid)
- `keywordId`
- `title`
- `slug` (unique)
- `content`
- `metaDescription`
- `status` (`draft | published | scheduled`)
- `publishedAt`
- `createdAt`
- `updatedAt`
- Relation: one post to one optional `SeoMetrics`

### `SeoMetrics`

- `id` (cuid)
- `postId` (unique)
- `backlinks`
- `traffic`
- `ranking`
- `fetchedAt`
- `updatedAt`

## Compatibility Notes

Some admin screens still consume legacy response keys. APIs currently expose compatibility fields:

- Keywords response includes `niche`, `status`, `createdAt`
- Metrics response includes `views`, `clicks`, `avgTimeOnPage`, `bounceRate`, `createdAt`
- Posts response includes computed `readingTime` (not stored in DB)

## Cron Jobs

Defined in `lib/cron/cron-service.ts` and triggerable from `/api/cron`:

- `generate-keywords`
- `generate-blog`
- `update-metrics`

Example:

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "Content-Type: application/json" \
  -d '{ "secret": "your-cron-secret", "job": "generate-keywords" }'
```

## Troubleshooting

- Prisma errors: run `prisma generate` after schema changes.
- Gemini errors: verify `GEMINI_API_KEY` and quota.
- Cron unauthorized: ensure `CRON_SECRET` matches request.

## License

MIT
