import slugify from 'slugify';

export interface MetaTags {
  title: string;
  description: string;
  keywords: string[];
  slug: string;
  ogImage?: string;
  canonicalUrl?: string;
}

/**
 * Generate URL-friendly slug from text
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Generate meta tags for a blog post
 */
export function generateMetaTags(
  title: string,
  description: string,
  keywords: string[],
  slug: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
): MetaTags {
  return {
    title,
    description,
    keywords,
    slug,
    canonicalUrl: `${baseUrl}/blog/${slug}`,
    ogImage: `${baseUrl}/og-image.png`,
  };
}

/**
 * Extract keywords from content
 */
export function extractKeywordsFromContent(content: string, limit: number = 5): string[] {
  // Simple keyword extraction - in production, use a more sophisticated approach
  const words = content
    .toLowerCase()
    .match(/\b\w{4,}\b/g) || [];

  const wordFreq: Record<string, number> = {};
  words.forEach((word) => {
    // Filter out common stop words
    const stopWords = [
      'this',
      'that',
      'with',
      'from',
      'have',
      'been',
      'also',
      'more',
      'which',
      'about',
      'your',
      'their',
    ];

    if (!stopWords.includes(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  return Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Generate internal linking suggestions
 */
export function suggestInternalLinks(
  currentKeyword: string,
  allKeywords: string[],
  limit: number = 3
): string[] {
  return allKeywords
    .filter((keyword) => keyword !== currentKeyword)
    .slice(0, limit);
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Validate meta description length
 */
export function isValidMetaDescription(description: string): boolean {
  return description.length >= 120 && description.length <= 160;
}

/**
 * Format publish date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Generate table of contents from markdown headings
 */
export function generateTableOfContents(content: string): Array<{ level: number; title: string; id: string }> {
  const headings: Array<{ level: number; title: string; id: string }> = [];
  const headingRegex = /^(#{2,6})\s+(.+)$/gm;

  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2];
    const id = generateSlug(title);

    headings.push({ level, title, id });
  }

  return headings;
}
