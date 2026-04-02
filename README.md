# AI SEO Blog System

Multi-tenant AI SEO content engine for teams managing multiple websites.

It handles:
- keyword discovery,
- blog drafting,
- publishing,
- distribution to user websites,
- analytics feedback loop for ranking improvements.

## 1) Core Capabilities

1. Multi-tenant workspace (`Tenant -> Website`).
2. Team access with token-based RBAC (`OWNER`, `EDITOR`, `VIEWER`).
3. AI keyword generation (`standard`, `comparison`, `mixed`).
4. AI blog generation with SEO metadata.
5. Publish workflow (`draft -> published`).
6. External push publish via webhook.
7. Pull APIs for public post listing/detail.
8. Per-website Google Search Console OAuth connection.
9. SEO metrics ingestion (`manual`, `simulated`, `gsc`).
10. Cron automation for recurring pipelines.
11. Internal link opportunity detection + auto-link insertion assistant.
12. SERP A/B testing (title/meta variants) with winner selection and apply flow.
13. AI visibility tracker for ChatGPT/Perplexity citations (mentions + share).
14. Backlink outreach CRM workflow with status pipeline and follow-up tracking.
15. LinkedIn + Twitter(X) SEO social post generator from published blogs.
16. Tech news trend tracker with 2-hour refresh cron and trending keyword extraction.

## 2) Tech Stack

- Next.js 16 (App Router)
- Prisma + PostgreSQL
- Google Gemini (`@google/generative-ai`)
- Tailwind + shadcn/ui
- node-cron (API-triggered)

## 3) Environment Setup

Copy env:

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `CRON_SECRET`
- `ADMIN_API_TOKEN`
- `APP_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

Common optional variables:

- `GEMINI_MODEL`
- `KEYWORDS_PER_NICHE`
- `COMPARISON_KEYWORDS_PER_NICHE`
- `BLOG_GENERATION_BATCH_SIZE`
- `AUTO_PUBLISH_GENERATED_POSTS`
- `BLOG_GENERATION_SCHEDULE`
- `METRICS_UPDATE_SCHEDULE`
- `GSC_SITE_URL`
- `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `DEFAULT_TENANT_ID`
- `DEFAULT_WEBSITE_ID`
- `EXTERNAL_PUBLISH_WEBHOOK_URL`
- `EXTERNAL_PUBLISH_WEBHOOK_SECRET`
- `CONTENT_API_KEY`
- `TECH_NEWS_SCHEDULE`

## 4) Install and Run

```bash
npm install
npx prisma db push
npx prisma generate
npm run dev
```

Run app at `http://localhost:3000`.

## 5) User Flow (End-to-End)

1. Login at `/auth` using admin token.
2. Create tenant + website from `/admin/websites`.
3. Select workspace (tenant + website) in admin header.
4. Generate keywords.
5. Generate blog drafts from keywords.
6. Publish posts.
7. Connect website via pull or push integration.
8. Connect Google Search Console per website from `/admin/websites`.
9. Track metrics and run optimization cycles.

Detailed guide:
- `docs/USER_WORKFLOW.md`

## 6) Website Integration Modes

1. Pull mode:
- Your website consumes `/api/public/posts` and `/api/public/posts/[slug]`.

2. Push mode:
- Use `/api/posts/publish-external` to send content to your website webhook.

3. Hybrid mode:
- Pull for rendering and push for event-driven deployment.

Integration details:
- `docs/INTEGRATION_GUIDE.md`
- `templates/nextjs-receiver-route.md`

## 7) How SEO Ranking Is Improved

System helps ranking by combining:

1. intent-aligned keyword generation,
2. consistent publish velocity,
3. technical SEO-safe output,
4. performance measurement and refresh loop.

Detailed ranking strategy:
- `docs/SEO_RANKING_PLAYBOOK.md`

## 8) Security and Access Model

1. Protected APIs require `x-admin-token` (or Bearer token).
2. RBAC roles:
- `OWNER`: all permissions + token management.
- `EDITOR`: content and publish operations.
- `VIEWER`: read-only.
3. Tenant scoping ensures team data isolation.
4. Public APIs can be protected using `CONTENT_API_KEY`.

## 9) API Coverage

Main endpoints:

- `POST/GET /api/tenants`
- `POST/GET /api/websites`
- `GET /api/auth/me`
- `POST/GET /api/auth/tokens`
- `PATCH /api/auth/tokens/[id]`
- `POST/GET /api/keywords/generate`
- `POST/GET /api/posts/generate`
- `PUT /api/posts/publish`
- `POST /api/posts/publish-external`
- `GET /api/public/posts`
- `GET /api/public/posts/[slug]`
- `GET/POST /api/metrics`
- `POST /api/metrics/gsc`
- `GET/POST /api/ai-visibility/mentions`
- `GET /api/ai-visibility/summary`
- `GET/POST /api/outreach/opportunities`
- `PATCH /api/outreach/opportunities/[id]`
- `GET/POST /api/social/generate`
- `GET/POST /api/cron`
- `GET/POST /api/tech-news`

Full API docs:
- `API.md`

## 10) Documentation Map

- Product docs UI: `/docs`
- User workflow: `docs/USER_WORKFLOW.md`
- Multi-tenant details: `docs/MULTI_TENANT_GUIDE.md`
- Integration patterns: `docs/INTEGRATION_GUIDE.md`
- Ranking playbook: `docs/SEO_RANKING_PLAYBOOK.md`
- API details: `API.md`

## 11) Verification

### Lint

```bash
npm run lint
```

### Type-check

```bash
npx tsc --noEmit
```

### End-to-end smoke flow

Run while app is running:

```bash
npm run test:e2e-smoke
```

Smoke test validates: auth, tenant+website context, keyword generation, post generation, publish, external publish, public feed/detail, metrics flow, and GSC endpoint contract.

Cron jobs currently supported:
- `generate-keywords`
- `generate-blog`
- `update-metrics`
- `tech-trends`
- `refresh-content` (automated refresh for declining published posts)

## 12) Troubleshooting

1. `401 Unauthorized` on admin APIs:
- invalid/missing token or role mismatch.

2. `401` on `/api/metrics/gsc`:
- `secret` does not match `CRON_SECRET`.

3. No public posts visible:
- post status not `published`, wrong tenant/website scope, or API key mismatch.

4. Prisma mismatch errors:
- rerun `npx prisma db push && npx prisma generate`.

## License

MIT
