export interface SeoAuditResult {
  score: number;
  suggestions: string[];
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
}): SeoAuditResult {
  const { title, metaDescription, content, keyword } = params;
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
  };

  const score =
    (checks.titleLength ? 12 : 0) +
    (checks.metaLength ? 12 : 0) +
    (checks.keywordInTitle ? 14 : 0) +
    (checks.keywordInMeta ? 10 : 0) +
    (checks.contentDepth ? 15 : 0) +
    (checks.headings ? 10 : 0) +
    (checks.keywordDensity ? 10 : 0) +
    (checks.internalLinks ? 10 : 0) +
    (checks.externalLinks ? 7 : 0);

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

  return {
    score: Math.max(0, Math.min(100, score)),
    suggestions,
    checks,
  };
}
