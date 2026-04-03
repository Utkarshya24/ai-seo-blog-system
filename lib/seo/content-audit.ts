export interface SeoAuditResult {
  score: number;
  suggestions: string[];
  scoreBreakdown: {
    onPage: number;
    technical: number;
    readability: number;
    performance: number;
  };
  metricsUsed: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  };
  checks: {
    titleLength: boolean;
    metaLength: boolean;
    keywordInTitle: boolean;
    keywordInMeta: boolean;
    contentDepth: boolean;
    headings: boolean;
    keywordDensity: boolean;
    internalLinks: boolean;
    externalLinks: boolean;
    imageAltText: boolean;
    schemaHints: boolean;
    readability: boolean;
    ctrHealthy: boolean;
    positionHealthy: boolean;
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countKeywordOccurrences(content: string, keyword: string): number {
  const normalizedContent = normalizeText(content);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return 0;
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = normalizedContent.match(new RegExp(escaped, 'g'));
  return matches?.length || 0;
}

export function auditPostSeo(params: {
  title: string;
  metaDescription: string;
  content: string;
  keyword: string;
  metrics?: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
    position?: number;
    ranking?: number;
  } | null;
}): SeoAuditResult {
  const { title, metaDescription, content, keyword, metrics } = params;
  const normalizedTitle = normalizeText(title);
  const normalizedMeta = normalizeText(metaDescription);
  const normalizedKeyword = normalizeText(keyword);

  const contentWords = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = contentWords.length;
  const keywordOccurrences = countKeywordOccurrences(content, keyword);
  const keywordDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;

  const headingsCount = (content.match(/^#{2,6}\s+/gm) || []).length;
  const internalLinksCount = (content.match(/\]\((\/(?!\/)[^)]+)\)/g) || []).length;
  const externalLinksCount = (content.match(/\]\((https?:\/\/[^)]+)\)/g) || []).length;
  const markdownImageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
  const imageWithAltCount = markdownImageMatches.filter((row) => /!\[[^\]]{3,}\]\(([^)]+)\)/.test(row)).length;
  const schemaHintsCount =
    (content.match(/"@type"\s*:\s*"(Article|FAQPage|HowTo|BreadcrumbList)"/gi) || []).length +
    (content.match(/\bFAQ\b|\bHow To\b/gi) || []).length;
  const sentenceCount = Math.max(1, (content.match(/[.!?]+/g) || []).length);
  const avgSentenceLength = wordCount / sentenceCount;
  const readabilityScore = 206.835 - 1.015 * avgSentenceLength - 84.6 * (1.5 / Math.max(1, wordCount / sentenceCount));

  const impressions = Number(metrics?.impressions || 0);
  const clicks = Number(metrics?.clicks || 0);
  const derivedCtr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
  const ctr = Number(metrics?.ctr ?? derivedCtr);
  const position = Number(metrics?.position || metrics?.ranking || 0);
  const hasPerformanceData = impressions > 0;

  const checks = {
    titleLength: title.trim().length >= 40 && title.trim().length <= 60,
    metaLength: metaDescription.trim().length >= 120 && metaDescription.trim().length <= 160,
    keywordInTitle: normalizedKeyword.length > 0 && normalizedTitle.includes(normalizedKeyword),
    keywordInMeta: normalizedKeyword.length > 0 && normalizedMeta.includes(normalizedKeyword),
    contentDepth: wordCount >= 800,
    headings: headingsCount >= 3,
    keywordDensity: keywordDensity >= 0.6 && keywordDensity <= 2.5,
    internalLinks: internalLinksCount >= 2,
    externalLinks: externalLinksCount >= 1,
    imageAltText: markdownImageMatches.length === 0 || imageWithAltCount === markdownImageMatches.length,
    schemaHints: schemaHintsCount > 0,
    readability: readabilityScore >= 45,
    ctrHealthy: !hasPerformanceData || ctr >= 2.0,
    positionHealthy: !hasPerformanceData || (position > 0 && position <= 20),
  };

  const onPageScore =
    (checks.titleLength ? 12 : 0) +
    (checks.metaLength ? 12 : 0) +
    (checks.keywordInTitle ? 14 : 0) +
    (checks.keywordInMeta ? 10 : 0) +
    (checks.contentDepth ? 15 : 0) +
    (checks.headings ? 10 : 0) +
    (checks.keywordDensity ? 10 : 0) +
    (checks.internalLinks ? 10 : 0) +
    (checks.externalLinks ? 7 : 0);
  const technicalScore = (checks.imageAltText ? 6 : 0) + (checks.schemaHints ? 6 : 0);
  const readabilityBucketScore = checks.readability ? 10 : 0;
  const performanceScore = hasPerformanceData
    ? (checks.ctrHealthy ? 8 : 0) + (checks.positionHealthy ? 8 : 0)
    : 8; // neutral baseline when performance data is unavailable

  const rawScore = onPageScore + technicalScore + readabilityBucketScore + performanceScore;

  const suggestions: string[] = [];
  if (!checks.titleLength) suggestions.push('Keep SEO title between 40 and 60 characters.');
  if (!checks.metaLength) suggestions.push('Keep meta description between 120 and 160 characters.');
  if (!checks.keywordInTitle) suggestions.push('Include target keyword in title naturally.');
  if (!checks.keywordInMeta) suggestions.push('Include target keyword in meta description.');
  if (!checks.contentDepth) suggestions.push('Expand content depth to at least 800 words.');
  if (!checks.headings) suggestions.push('Use at least 3 section headings (H2/H3).');
  if (!checks.keywordDensity) suggestions.push('Maintain keyword density around 0.6% to 2.5%.');
  if (!checks.internalLinks) suggestions.push('Add at least 2 internal links to relevant posts.');
  if (!checks.externalLinks) suggestions.push('Add at least 1 high-authority external reference link.');
  if (!checks.imageAltText) suggestions.push('Use descriptive alt text for every image.');
  if (!checks.schemaHints) suggestions.push('Add schema markup hints (FAQ/HowTo/Article JSON-LD) where relevant.');
  if (!checks.readability) suggestions.push('Improve readability by shortening long sentences and simplifying wording.');
  if (hasPerformanceData && !checks.ctrHealthy) suggestions.push('Improve CTR with stronger title hooks and clearer meta benefits.');
  if (hasPerformanceData && !checks.positionHealthy) suggestions.push('Strengthen relevance and internal linking to improve average position.');

  return {
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    suggestions,
    scoreBreakdown: {
      onPage: Math.min(60, Math.round(onPageScore)),
      technical: Math.min(15, Math.round(technicalScore)),
      readability: Math.min(10, Math.round(readabilityBucketScore)),
      performance: Math.min(15, Math.round(performanceScore)),
    },
    metricsUsed: {
      impressions,
      clicks,
      ctr,
      position,
    },
    checks,
  };
}
