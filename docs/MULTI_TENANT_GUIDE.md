# Multi-Tenant Guide

This project now supports a foundational multi-tenant model:

- One `Tenant` can have multiple `Website` records.
- `Keyword`, `Post`, and `SeoMetrics` can be scoped by `tenantId` and `websiteId`.
- Core APIs resolve tenant context from:
  - `x-tenant-id` header (or `tenantId` query param)
  - `x-website-id` header (or `websiteId` query param)

## 1) Create Tenant and Website

Create tenant:

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme SEO"}'
```

Create website:

```bash
curl -X POST http://localhost:3000/api/websites \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId":"TENANT_ID",
    "name":"Main Site",
    "domain":"example.com",
    "baseUrl":"https://example.com",
    "niche":"ai tools"
  }'
```

## 2) Call Existing APIs With Context

Example:

```bash
curl -X POST http://localhost:3000/api/keywords/generate \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: TENANT_ID" \
  -H "x-website-id: WEBSITE_ID" \
  -d '{"niche":"AI tools","count":8,"mode":"mixed"}'
```

Same headers work for:

- `/api/posts/generate`
- `/api/posts/publish`
- `/api/posts/publish-external`
- `/api/metrics`
- `/api/metrics/gsc`
- `/api/public/posts*`

## 3) Cron Context

Cron jobs can run against one default tenant/site using env:

- `DEFAULT_TENANT_ID`
- `DEFAULT_WEBSITE_ID`

If these are unset, cron runs in backward-compatible mode.

## 4) Migration

After pulling these changes, apply schema updates:

```bash
npx prisma db push
npx prisma generate
```
