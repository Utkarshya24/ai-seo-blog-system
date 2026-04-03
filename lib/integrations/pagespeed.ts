export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number | null; // 0-100
  lcpMs: number | null;
  cls: number | null;
}

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const memoryCache = new Map<string, { expiresAt: number; value: PageSpeedResult | null }>();

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function fetchPageSpeedMetrics(params: {
  url: string;
  strategy?: 'mobile' | 'desktop';
  apiKey?: string;
}): Promise<PageSpeedResult | null> {
  const { url, strategy = 'mobile', apiKey } = params;
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;

  const cacheKey = `${strategy}:${cleanUrl}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', cleanUrl);
    endpoint.searchParams.set('strategy', strategy);
    if (apiKey?.trim()) endpoint.searchParams.set('key', apiKey.trim());

    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ai-seo-blog-system/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[PageSpeed] request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      lighthouseResult?: {
        categories?: {
          performance?: { score?: number };
        };
        audits?: {
          'largest-contentful-paint'?: { numericValue?: number };
          'cumulative-layout-shift'?: { numericValue?: number };
        };
      };
    };

    const perfScore = payload.lighthouseResult?.categories?.performance?.score;
    const result: PageSpeedResult = {
      url: cleanUrl,
      strategy,
      performanceScore: Number.isFinite(perfScore) ? Math.round((perfScore as number) * 100) : null,
      lcpMs: toNumber(payload.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue),
      cls: toNumber(payload.lighthouseResult?.audits?.['cumulative-layout-shift']?.numericValue),
    };

    memoryCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  } catch (error) {
    console.warn('[PageSpeed] metrics fetch failed:', error);
    memoryCache.set(cacheKey, { expiresAt: Date.now() + 1000 * 60 * 5, value: null });
    return null;
  }
}
