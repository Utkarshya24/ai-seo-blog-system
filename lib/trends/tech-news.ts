import { prisma } from '@/lib/db';

interface ParsedRssItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
  source: string;
}

const TECH_RSS_SOURCES: Array<{ source: string; url: string }> = [
  { source: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { source: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { source: 'Wired', url: 'https://www.wired.com/feed/rss' },
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'about', 'over', 'under',
  'after', 'before', 'during', 'what', 'when', 'where', 'how', 'why', 'are', 'was', 'were', 'has',
  'have', 'had', 'you', 'they', 'their', 'them', 'its', 'it', 'new', 'now', 'top', 'best', 'will',
  'can', 'not', 'but', 'all', 'our', 'out', 'get', 'just', 'more', 'than', 'who', 'says', 'say',
  'tech', 'today', 'week', 'year',
]);

function stripTags(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(itemXml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = itemXml.match(regex);
  return match ? stripTags(match[1]) : '';
}

function parseRss(xml: string, source: string): ParsedRssItem[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  return itemBlocks
    .map((itemXml) => {
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const description = extractTag(itemXml, 'description');
      const pubDateRaw = extractTag(itemXml, 'pubDate');
      const publishedAt = pubDateRaw ? new Date(pubDateRaw) : null;
      return {
        title,
        url: link,
        summary: description,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        source,
      };
    })
    .filter((item) => item.title && item.url);
}

function keywordTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function extractTrendingKeywords(titles: string[], limit = 12): string[] {
  const frequency = new Map<string, number>();
  for (const title of titles) {
    for (const token of keywordTokens(title)) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function computeScore(item: ParsedRssItem): number {
  const ageHours = item.publishedAt
    ? Math.max(0, (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60))
    : 48;
  const recencyScore = Math.max(0, 100 - Math.round(ageHours * 2));
  const sourceBonus = item.source === 'TechCrunch' ? 8 : item.source === 'The Verge' ? 6 : 4;
  return recencyScore + sourceBonus;
}

export async function refreshTrendingTechNews(params?: { maxPerSource?: number }) {
  const maxPerSource = Math.max(5, Math.min(25, Number(params?.maxPerSource || 12)));
  const results = await Promise.all(
    TECH_RSS_SOURCES.map(async (sourceDef) => {
      try {
        const res = await fetch(sourceDef.url, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`[TechTrends] Failed source ${sourceDef.source} (${res.status})`);
          return [] as ParsedRssItem[];
        }
        const xml = await res.text();
        return parseRss(xml, sourceDef.source).slice(0, maxPerSource);
      } catch (error) {
        console.warn(`[TechTrends] Source error ${sourceDef.source}:`, error);
        return [] as ParsedRssItem[];
      }
    })
  );

  const items = results.flat();
  if (items.length === 0) {
    return { inserted: 0, updated: 0, keywords: [] as string[] };
  }

  const keywords = extractTrendingKeywords(items.map((item) => item.title));
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const score = computeScore(item);
    const upserted = await prisma.techNewsItem.upsert({
      where: { url: item.url },
      update: {
        title: item.title,
        source: item.source,
        summary: item.summary || null,
        publishedAt: item.publishedAt,
        score,
        trendingKeywords: keywords,
        fetchedAt: new Date(),
      },
      create: {
        title: item.title,
        url: item.url,
        source: item.source,
        summary: item.summary || null,
        publishedAt: item.publishedAt,
        score,
        trendingKeywords: keywords,
      },
    });

    if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated, keywords };
}

export async function getTrendingTechNews(params?: { page?: number; limit?: number }) {
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.max(1, Math.min(20, Number(params?.limit || 20)));
  const skip = (page - 1) * limit;
  const where = {};
  const total = await prisma.techNewsItem.count({ where });
  const rows = await prisma.techNewsItem.findMany({
    where,
    orderBy: [{ score: 'desc' }, { publishedAt: 'desc' }, { fetchedAt: 'desc' }],
    skip,
    take: limit,
  });

  const keywordFrequency = new Map<string, number>();
  for (const row of rows) {
    for (const keyword of row.trendingKeywords || []) {
      keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
    }
  }

  const trendingKeywords = Array.from(keywordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([keyword]) => keyword);

  return {
    items: rows,
    trendingKeywords,
    generatedAt: rows[0]?.fetchedAt || null,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
