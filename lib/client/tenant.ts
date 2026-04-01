'use client';

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

export interface WebsiteOption {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  baseUrl: string;
  niche: string;
}

const TENANT_KEY = 'seo-admin-tenant-id';
const WEBSITE_KEY = 'seo-admin-website-id';
const TOKEN_KEY = 'seo-admin-token';

export function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TENANT_KEY);
}

export function getStoredWebsiteId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WEBSITE_KEY);
}

export function setStoredTenantId(value: string | null) {
  if (typeof window === 'undefined') return;
  if (!value) {
    localStorage.removeItem(TENANT_KEY);
    return;
  }
  localStorage.setItem(TENANT_KEY, value);
}

export function setStoredWebsiteId(value: string | null) {
  if (typeof window === 'undefined') return;
  if (!value) {
    localStorage.removeItem(WEBSITE_KEY);
    return;
  }
  localStorage.setItem(WEBSITE_KEY, value);
}

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAdminToken(value: string | null) {
  if (typeof window === 'undefined') return;
  if (!value) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearStoredWorkspace() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(WEBSITE_KEY);
}

export function buildTenantHeaders(headers?: HeadersInit): Headers {
  const finalHeaders = new Headers(headers || {});
  const tenantId = getStoredTenantId();
  const websiteId = getStoredWebsiteId();
  const token = getStoredAdminToken();

  if (tenantId) {
    finalHeaders.set('x-tenant-id', tenantId);
  }
  if (websiteId) {
    finalHeaders.set('x-website-id', websiteId);
  }
  if (token) {
    finalHeaders.set('x-admin-token', token);
  }

  return finalHeaders;
}

export async function tenantFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: buildTenantHeaders(init?.headers),
  });
}
