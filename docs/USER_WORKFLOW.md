# User Workflow Guide

This guide explains exactly how an end user should run the product from first login to publishing SEO blogs for multiple websites.

## 1) Login and Workspace Setup

1. Open `/auth`.
2. Paste your admin token.
3. You will be redirected to `/admin` if token is valid.
4. Select tenant and website in the admin header.

Notes:
- Token is stored in browser `localStorage` for session continuity.
- Every protected API call uses this token via `x-admin-token` header.
- Tenant and website are also persisted locally for quick switching.

## 2) Create Team Structure

1. Go to `/admin/team`.
2. Create token for team member with correct role:
- `OWNER`: full access + token management.
- `EDITOR`: content operations and publishing.
- `VIEWER`: read-only.
3. For tenant-scoped members, assign the correct tenant when creating token.
4. Revoke token immediately if teammate leaves.

## 3) Add Tenant and Website

1. Go to `/admin/websites`.
2. Create tenant (if not already available).
3. Add website inside that tenant:
- `name`
- `domain`
- `baseUrl`
- `niche`
4. Set website active/inactive based on operations.
5. Add `gscProperty` (example: `sc-domain:example.com`) and click `Connect GSC` for that website.

Why this matters:
- Isolation: one tenant can manage many websites safely.
- Data safety: keywords/posts/metrics remain scoped.

## 4) Keyword Research Flow

1. Use keyword generation from admin/API.
2. Pick `mode` based on strategy:
- `standard`: informational long-tail clusters.
- `comparison`: BOFU-style "X vs Y" intent.
- `mixed`: balanced growth.
3. Keep keyword batches niche-specific per website.

Best practice:
- Publish in topical clusters instead of random one-off keywords.

## 5) Blog Generation Flow

1. Generate draft post from selected keyword.
2. Review title and content.
3. Publish when ready.

Generated SEO assets include:
- slug
- meta description
- structured JSON-LD payload
- title constraints for SERP readability

## 6) Publish to User Website

You have 2 ways:

1. Pull mode (recommended):
- Website fetches from `/api/public/posts` and `/api/public/posts/[slug]`.

2. Push mode:
- Use `/api/posts/publish-external` to send content to website webhook.

Choose hybrid if needed:
- Pull for rendering + push to trigger deployment/webhook workflows.

## 7) Metrics and Performance

1. Use `/api/metrics` for manual or app-fed data.
2. Use `/api/metrics/gsc` for Google Search Console sync.
3. Prefer per-website OAuth connection instead of global access token.
4. Track impressions, clicks, CTR, ranking, position.
5. Re-optimize pages with low CTR or weak ranking.

## 8) Daily Operating Checklist

1. Generate fresh keywords.
2. Publish new posts.
3. Check GSC sync.
4. Find declining pages and refresh content.
5. Verify website/tenant scoping before bulk operations.

## 9) Common Failure Cases

1. `401 Unauthorized`:
- Missing/invalid admin token, or missing cron secret for GSC endpoint.

2. Empty public feed:
- Post not published, wrong tenant/website scope, or API key mismatch.

3. No ranking movement:
- Weak keyword intent match, low internal linking, or insufficient refresh cycles.

## 10) Minimum Production Setup

1. `ADMIN_API_TOKEN` configured.
2. `CRON_SECRET` configured.
3. `CONTENT_API_KEY` enabled for public APIs.
4. `GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN` + `GSC_SITE_URL` configured.
5. Cron jobs scheduled for keywords/blog/metrics/content-refresh.
