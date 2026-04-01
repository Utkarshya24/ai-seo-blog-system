#!/usr/bin/env node
import http from 'node:http';

function fail(message, details) {
  console.error(`\n[FAIL] ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function assertOk(response, label) {
  if (!response.ok) {
    return response.text().then((text) => {
      fail(`${label} failed with ${response.status}`, text);
    });
  }
  return Promise.resolve();
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_API_TOKEN;
  const contentApiKey = process.env.CONTENT_API_KEY || '';

  if (!adminToken) fail('ADMIN_API_TOKEN is required for smoke test.');

  const state = {
    tenantId: process.env.DEFAULT_TENANT_ID || '',
    websiteId: process.env.DEFAULT_WEBSITE_ID || '',
    keywordId: '',
    postId: '',
    slug: '',
  };

  const headers = (extra = {}, scoped = true) => ({
    'Content-Type': 'application/json',
    'x-admin-token': adminToken,
    ...(scoped && state.tenantId ? { 'x-tenant-id': state.tenantId } : {}),
    ...(scoped && state.websiteId ? { 'x-website-id': state.websiteId } : {}),
    ...extra,
  });

  async function api(path, init = {}, scoped = true) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...headers(init.headers || {}, scoped),
      },
    });
  }

  console.log('[1/9] Auth check...');
  const meRes = await api('/api/auth/me', { method: 'GET' }, false);
  await assertOk(meRes, 'GET /api/auth/me');
  const me = await meRes.json();
  if (!me?.authenticated) fail('Auth response did not mark authenticated.');

  console.log('[2/9] Resolve tenant + website...');
  const tenantsRes = await api('/api/tenants', { method: 'GET' }, false);
  await assertOk(tenantsRes, 'GET /api/tenants');
  const tenantsPayload = await tenantsRes.json();
  const tenants = tenantsPayload.tenants || [];
  if (!state.tenantId) {
    state.tenantId = tenants[0]?.id || '';
  }
  if (!state.tenantId) fail('No tenant available; create one first.');

  let websitesRes = await api(`/api/websites?tenantId=${encodeURIComponent(state.tenantId)}`, { method: 'GET' }, false);
  await assertOk(websitesRes, 'GET /api/websites');
  let websitesPayload = await websitesRes.json();
  let websites = websitesPayload.websites || [];

  if (!state.websiteId && websites.length === 0) {
    const randomDomain = `smoke-${Date.now()}.example.com`;
    const createWebsiteRes = await api(
      '/api/websites',
      {
        method: 'POST',
        body: JSON.stringify({
          tenantId: state.tenantId,
          name: 'Smoke Test Site',
          domain: randomDomain,
          baseUrl: `https://${randomDomain}`,
          niche: 'smoke testing',
        }),
      },
      false
    );
    await assertOk(createWebsiteRes, 'POST /api/websites');
    websitesRes = await api(`/api/websites?tenantId=${encodeURIComponent(state.tenantId)}`, { method: 'GET' }, false);
    await assertOk(websitesRes, 'GET /api/websites refresh');
    websitesPayload = await websitesRes.json();
    websites = websitesPayload.websites || [];
  }

  if (!state.websiteId) {
    state.websiteId = websites[0]?.id || '';
  }
  if (!state.websiteId) fail('No website available for smoke test.');

  console.log('[3/9] Generate keyword...');
  const keywordRes = await api('/api/keywords/generate', {
    method: 'POST',
    body: JSON.stringify({
      niche: 'smoke testing seo',
      count: 1,
      mode: 'standard',
    }),
  });
  await assertOk(keywordRes, 'POST /api/keywords/generate');
  const keywordData = await keywordRes.json();
  state.keywordId = keywordData?.keywords?.[0]?.id;
  if (!state.keywordId) fail('Keyword generation did not return keyword id.', keywordData);

  console.log('[4/9] Generate draft post...');
  const title = `Smoke SEO Flow ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const postGenerateRes = await api('/api/posts/generate', {
    method: 'POST',
    body: JSON.stringify({
      keywordId: state.keywordId,
      title,
      tone: 'professional',
    }),
  });
  await assertOk(postGenerateRes, 'POST /api/posts/generate');
  const postGenerateData = await postGenerateRes.json();
  state.postId = postGenerateData?.post?.id;
  state.slug = postGenerateData?.post?.slug;
  if (!state.postId || !state.slug) fail('Post generation missing id/slug.', postGenerateData);

  console.log('[5/9] Publish post...');
  const publishRes = await api('/api/posts/publish', {
    method: 'PUT',
    body: JSON.stringify({ postId: state.postId }),
  });
  await assertOk(publishRes, 'PUT /api/posts/publish');

  console.log('[6/9] External publish webhook (mock receiver)...');
  let receivedPayload = null;
  const receiver = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      return res.end('method not allowed');
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        receivedPayload = JSON.parse(body);
      } catch {
        receivedPayload = { raw: body };
      }
      res.statusCode = 200;
      res.end('ok');
    });
  });
  await new Promise((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const { port } = receiver.address();
  const webhookUrl = `http://127.0.0.1:${port}/ingest`;

  const externalRes = await api('/api/posts/publish-external', {
    method: 'POST',
    body: JSON.stringify({
      postId: state.postId,
      webhookUrl,
      publishIfDraft: true,
    }),
  });
  await assertOk(externalRes, 'POST /api/posts/publish-external');
  await new Promise((resolve) => setTimeout(resolve, 150));
  receiver.close();
  if (!receivedPayload || receivedPayload.slug !== state.slug) {
    fail('External webhook did not receive expected payload.', receivedPayload);
  }

  console.log('[7/9] Public feed + detail verify...');
  const publicFeedRes = await fetch(
    `${baseUrl}/api/public/posts?limit=10&includeContent=false${contentApiKey ? `&apiKey=${encodeURIComponent(contentApiKey)}` : ''}`,
    {
      headers: {
        ...(state.tenantId ? { 'x-tenant-id': state.tenantId } : {}),
        ...(state.websiteId ? { 'x-website-id': state.websiteId } : {}),
      },
    }
  );
  await assertOk(publicFeedRes, 'GET /api/public/posts');
  const publicFeedData = await publicFeedRes.json();
  const hasPost = (publicFeedData.posts || []).some((p) => p.slug === state.slug);
  if (!hasPost) fail('Published post not found in public feed.', publicFeedData);

  const publicDetailRes = await fetch(
    `${baseUrl}/api/public/posts/${encodeURIComponent(state.slug)}${contentApiKey ? `?apiKey=${encodeURIComponent(contentApiKey)}` : ''}`,
    {
      headers: {
        ...(state.tenantId ? { 'x-tenant-id': state.tenantId } : {}),
        ...(state.websiteId ? { 'x-website-id': state.websiteId } : {}),
      },
    }
  );
  await assertOk(publicDetailRes, 'GET /api/public/posts/[slug]');

  console.log('[8/9] Metrics upsert and read...');
  const metricsPostRes = await api('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({
      postId: state.postId,
      impressions: 300,
      clicks: 36,
      ctr: 12,
      ranking: 9,
      position: 9.4,
      source: 'manual',
    }),
  });
  await assertOk(metricsPostRes, 'POST /api/metrics');

  const metricsGetRes = await api(`/api/metrics?postId=${encodeURIComponent(state.postId)}`, { method: 'GET' });
  await assertOk(metricsGetRes, 'GET /api/metrics?postId=');
  const metricsData = await metricsGetRes.json();
  if ((metricsData?.clicks || 0) < 1) fail('Metrics payload did not contain expected clicks.', metricsData);

  console.log('[9/9] GSC endpoint contract check...');
  const gscRes = await api('/api/metrics/gsc', {
    method: 'POST',
    body: JSON.stringify({
      secret: process.env.CRON_SECRET || 'missing',
      siteUrl: process.env.GSC_SITE_URL || '',
      startDate: '2026-03-01',
      endDate: '2026-03-02',
    }),
  });
  const gscBody = await gscRes.json();
  if (!gscRes.ok && gscRes.status !== 400 && gscRes.status !== 401 && gscRes.status !== 500) {
    fail('Unexpected GSC endpoint response code.', { status: gscRes.status, gscBody });
  }

  console.log('\n[PASS] E2E smoke flow completed.');
  console.log(JSON.stringify({
    tenantId: state.tenantId,
    websiteId: state.websiteId,
    keywordId: state.keywordId,
    postId: state.postId,
    slug: state.slug,
    gscStatus: gscRes.status,
  }, null, 2));
}

main().catch((error) => fail('Unhandled smoke test error', error));
