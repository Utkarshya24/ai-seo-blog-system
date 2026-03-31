# AI SEO Blog System

A production-ready blog system that uses AI to generate, manage, and optimize SEO-friendly content. Built with Next.js 16, Prisma, Google Gemini API, and Neon PostgreSQL.

## Features

- **AI-Powered Keyword Generation**: Automatically generate SEO keywords for any niche using Google Gemini
- **Smart Content Creation**: Convert keywords into full, well-structured blog posts with Gemini AI
- **SEO Optimization**: Auto-generate meta descriptions, URL slugs, and internal linking
- **Cron Job Automation**: Schedule keyword generation, blog posting, and metrics updates
- **Performance Tracking**: Monitor views, clicks, bounce rates, and engagement per post
- **Admin Dashboard**: Comprehensive UI for managing keywords, posts, and metrics
- **Public Blog Pages**: Beautiful, SEO-optimized blog listing and detail pages

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon PostgreSQL (serverless)
- **ORM**: Prisma
- **AI**: Google Gemini API (gemini-pro)
- **Task Scheduling**: node-cron
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui

## Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `GEMINI_API_KEY`: Your Google Gemini API key
- `CRON_SECRET`: Secret key for triggering cron jobs (auto-generated or custom)
- `NEXT_PUBLIC_APP_URL`: Your app's public URL (for og:image and canonical URLs)

### 2. Database Setup

Push the Prisma schema to your database:

```bash
pnpm prisma db push
```

Generate Prisma client:

```bash
pnpm prisma generate
```

### 3. Install Dependencies

Dependencies are automatically installed with Vercel's environment, but you can manually install:

```bash
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` to see the home page.

## Project Structure

```
.
├── app/
│   ├── api/                 # API routes
│   │   ├── keywords/        # Keyword generation endpoints
│   │   ├── posts/          # Blog post endpoints
│   │   ├── metrics/        # SEO metrics endpoints
│   │   └── cron/           # Cron job triggers
│   ├── blog/               # Public blog pages
│   │   ├── page.tsx        # Blog listing
│   │   └── [slug]/         # Blog post detail
│   ├── admin/              # Admin dashboard
│   │   ├── page.tsx        # Dashboard overview
│   │   ├── keywords/       # Keywords manager
│   │   ├── posts/          # Posts manager
│   │   └── metrics/        # Metrics dashboard
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── lib/
│   ├── ai/                 # AI service layer
│   │   └── openai-service.ts
│   ├── cron/               # Cron jobs
│   │   └── cron-service.ts
│   ├── utils/              # Utility functions
│   │   └── seo.ts
│   └── db.ts               # Prisma client
├── prisma/
│   └── schema.prisma       # Database schema
└── public/                 # Static assets
```

## API Endpoints

### Keywords
- `POST /api/keywords/generate` - Generate new keywords (body: `{ niche, count }`)
- `GET /api/keywords/generate` - Get all keywords (query: `?status=pending&niche=AI`)

### Blog Posts
- `POST /api/posts/generate` - Generate new blog post (body: `{ keywordId, title, tone }`)
- `GET /api/posts/generate` - Get all posts (query: `?status=draft&keywordId=xxx`)
- `PUT /api/posts/publish` - Publish a post (body: `{ postId }`)

### Metrics
- `GET /api/metrics` - Get all metrics or by post (query: `?postId=xxx`)
- `POST /api/metrics` - Create/update metrics

### Cron Jobs
- `POST /api/cron` - Trigger cron job (body: `{ secret, job }`)
- `GET /api/cron` - Trigger cron job via query string

## Cron Jobs

The system includes three automated cron jobs:

1. **Daily Keyword Generation** (0 0 * * *)
   - Generates 3 keywords for each configured niche
   - Runs daily at midnight

2. **Weekly Blog Generation** (0 2 * * 1)
   - Creates blog posts from pending keywords
   - Auto-publishes 2 posts per week
   - Runs Monday at 2 AM

3. **Weekly Metrics Update** (0 6 * * 1)
   - Simulates performance metrics for published posts
   - Tracks views, clicks, bounce rates
   - Runs Monday at 6 AM

To trigger manually:
```bash
curl -X POST http://localhost:3000/api/cron \
  -H "Content-Type: application/json" \
  -d '{ "secret": "your-cron-secret", "job": "generate-keywords" }'
```

## Usage Flow

### For Content Creators (Admin)

1. Go to `/admin/keywords`
   - Enter a niche (e.g., "AI tools")
   - Click "Generate Keywords"
   - AI generates 5 keywords for that niche

2. Go to `/admin/posts`
   - Select a pending keyword
   - Enter a post title
   - Click "Generate Post"
   - AI creates a full blog post with SEO metadata

3. Review and click "Publish"
   - Post becomes visible on the public blog

4. Go to `/admin/metrics`
   - View performance data for all published posts
   - Monitor views, clicks, and engagement

### For Readers

1. Visit `/blog`
   - See all published blog posts
   - Click on a post to read the full content

2. Read individual posts at `/blog/[slug]`
   - View complete article with metadata
   - See reading time, publication date, and related info

## Database Schema

### Keyword
- `id`: UUID primary key
- `keyword`: The SEO keyword text
- `niche`: Category/niche this keyword belongs to
- `status`: 'pending' | 'used'
- `searchVolume`: Estimated monthly search volume
- `createdAt`: Timestamp

### Post
- `id`: UUID primary key
- `title`: Blog post title
- `content`: Full blog post content
- `slug`: URL-friendly slug
- `keywordId`: Foreign key to Keyword
- `metaDescription`: SEO meta description
- `status`: 'draft' | 'published'
- `readingTime`: Estimated reading time in minutes
- `publishedAt`: Publication timestamp
- `createdAt`: Creation timestamp
- `updatedAt`: Last updated timestamp

### SeoMetrics
- `id`: UUID primary key
- `postId`: Foreign key to Post
- `views`: Total page views
- `clicks`: Total search clicks
- `avgTimeOnPage`: Average time spent (seconds)
- `bounceRate`: Bounce rate percentage
- `createdAt`: Timestamp
- `updatedAt`: Last updated timestamp

## Configuration

### Custom Niches

Edit `lib/cron/cron-service.ts` to change the default niches for daily keyword generation:

```typescript
const niches = ['AI tools', 'machine learning', 'web development', 'productivity'];
```

### Cron Schedules

Modify cron schedules in `lib/cron/cron-service.ts`:

```typescript
// Examples of cron syntax:
'0 0 * * *'    // Every day at midnight
'0 2 * * 1'    // Every Monday at 2 AM
'*/5 * * * *'  // Every 5 minutes
```

### OpenAI Model

Change the model in `lib/ai/openai-service.ts`:

```typescript
model: 'gpt-4o-mini'  // Change to 'gpt-4', 'gpt-3.5-turbo', etc.
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add environment variables in project settings:
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL`
4. Deploy!

Note: Cron jobs run on a schedule. For production, consider using Vercel Cron or a service like EasyCron to trigger `/api/cron` endpoints.

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check Neon project is active
- Run `pnpm prisma db push` to sync schema

### OpenAI API Errors
- Verify `OPENAI_API_KEY` is valid
- Check API quota and usage
- Ensure account has access to gpt-4o-mini

### Cron Jobs Not Running
- Verify `CRON_SECRET` environment variable is set
- Check cron job scheduling with correct secret
- Review API logs for errors

## License

MIT

## Support

For issues or questions, please check the Vercel documentation or OpenAI API reference.
