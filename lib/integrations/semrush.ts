export interface SemrushDomainOverview {
  domain: string;
  rank: number;
  organicKeywords: number;
  organicTraffic: number;
  organicCost: number;
}

function parseSemrushCsvLine(line: string): string[] {
  return line.split(';').map((cell) => cell.replace(/^"|"$/g, '').trim());
}

export async function fetchSemrushDomainOverview(params: {
  domain: string;
  apiKey: string;
  database?: string;
}): Promise<SemrushDomainOverview | null> {
  const { domain, apiKey, database = 'us' } = params;
  const cleanDomain = domain.trim().toLowerCase();
  if (!cleanDomain || !apiKey.trim()) return null;

  const endpoint = new URL('https://api.semrush.com/');
  endpoint.searchParams.set('type', 'domain_rank');
  endpoint.searchParams.set('key', apiKey.trim());
  endpoint.searchParams.set('domain', cleanDomain);
  endpoint.searchParams.set('database', database);
  endpoint.searchParams.set('display_limit', '1');
  endpoint.searchParams.set('export_escape', '1');
  endpoint.searchParams.set('export_columns', 'Dn,Rk,Or,Ot,Oc');

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'ai-seo-blog-system/1.0',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`[SEMrush] Request failed (${response.status}): ${text}`);
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;
  const data = parseSemrushCsvLine(lines[1]);
  if (data.length < 5) return null;

  return {
    domain: data[0] || cleanDomain,
    rank: Number(data[1] || 0),
    organicKeywords: Number(data[2] || 0),
    organicTraffic: Number(data[3] || 0),
    organicCost: Number(data[4] || 0),
  };
}
