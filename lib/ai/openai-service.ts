import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const modelCandidates = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-3-flash,gemini-2.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

class AIServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
  }
}

function isModelNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('is not found for api version') ||
    message.includes('not supported for generatecontent') ||
    message.includes('404 not found')
  );
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('429 too many requests') ||
    message.includes('quota exceeded') ||
    message.includes('rate limit')
  );
}

function isServiceUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('503 service unavailable') ||
    message.includes('currently experiencing high demand') ||
    message.includes('try again later')
  );
}

async function generateText(prompt: string): Promise<string> {
  let lastError: unknown;
  let sawQuotaOrRateLimit = false;
  let sawModelNotFound = false;
  let sawServiceUnavailable = false;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const response = await model.generateContent(prompt);
      return response.response.text() || '';
    } catch (error) {
      lastError = error;
      if (isQuotaOrRateLimitError(error)) {
        sawQuotaOrRateLimit = true;
        continue;
      }
      if (isServiceUnavailableError(error)) {
        sawServiceUnavailable = true;
        continue;
      }
      if (isModelNotFoundError(error)) {
        sawModelNotFound = true;
        continue;
      }
      throw error;
    }
  }

  if (sawQuotaOrRateLimit) {
    throw new AIServiceError(
      `Gemini quota/rate limit exceeded across configured models: ${modelCandidates.join(', ')}`,
      429
    );
  }

  if (sawServiceUnavailable) {
    throw new AIServiceError(
      `Gemini service is temporarily unavailable/high-demand across configured models: ${modelCandidates.join(', ')}`,
      503
    );
  }

  if (sawModelNotFound) {
    throw new AIServiceError(
      `No configured Gemini model is available for generateContent. Tried: ${modelCandidates.join(', ')}`,
      404
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate content with configured Gemini models');
}

export interface KeywordPrompt {
  niche: string;
  count?: number;
  includeComparison?: boolean;
  trendHints?: string[];
}

export interface BlogPrompt {
  keyword: string;
  title: string;
  tone?: string;
  maxTokens?: number;
}

export interface SerpOptimizationInput {
  keyword: string;
  currentTitle: string;
  currentMetaDescription: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position?: number;
}

export interface SocialPostInput {
  title: string;
  keyword: string;
  metaDescription: string;
  url: string;
}

/**
 * Generate SEO keywords for a given niche
 */
export async function generateKeywords(prompt: KeywordPrompt): Promise<string[]> {
  const { niche, count = 5, includeComparison = false, trendHints = [] } = prompt;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const trendContext = trendHints.length
      ? `Use these current trend hints when relevant: ${trendHints.slice(0, 12).join(', ')}.`
      : 'Use currently relevant market trends where appropriate.';
    const systemPrompt =
      `You are an SEO expert. Today is ${today}. Generate high-quality long-tail keywords with realistic modern intent and strong search potential. Return only a JSON array of strings with no extra text.`;
    const comparisonInstruction = includeComparison
      ? 'At least half of the keywords must be comparison intent and include "vs" between two alternatives.'
      : '';
    const userPrompt = `Generate ${count} SEO-friendly keywords for niche: "${niche}". ${comparisonInstruction} Prioritize actionable, low-to-medium competition opportunities. ${trendContext}`;

    const content = await generateText(`${systemPrompt}\n\n${userPrompt}`);

    if (!content) return [];

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return [];
  } catch (error) {
    console.error('[AI Service] Error generating keywords:', error);
    throw error;
  }
}

/**
 * Generate comparison intent keywords in "X vs Y" format
 */
export async function generateComparisonKeywords(prompt: KeywordPrompt): Promise<string[]> {
  const { niche, count = 5, trendHints = [] } = prompt;

  try {
    const trendContext = trendHints.length
      ? `Use these trend hints when relevant: ${trendHints.slice(0, 10).join(', ')}.`
      : '';
    const systemPrompt =
      'You are an SEO strategist focused on high-intent comparison queries. Return only a JSON array of strings.';
    const userPrompt = `Generate ${count} comparison keywords for "${niche}" in strict "X vs Y" format. Keep them realistic for search intent. ${trendContext} Return as JSON array.`;
    const content = await generateText(`${systemPrompt}\n\n${userPrompt}`);

    if (!content) return [];

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as string[];
    return parsed
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && /\bvs\b/i.test(item));
  } catch (error) {
    console.error('[AI Service] Error generating comparison keywords:', error);
    throw error;
  }
}

/**
 * Generate blog post content for a keyword
 */
export async function generateBlogPost(prompt: BlogPrompt): Promise<string> {
  const { keyword, title, tone = 'professional' } = prompt;

  try {
    const systemPrompt = `You are an expert content writer. Write engaging, SEO-optimized blog posts. Use a ${tone} tone. Include proper headings, paragraphs, and natural language. Make the content unique and valuable.`;
    const userPrompt = `Write a comprehensive blog post about "${keyword}" with the title "${title}". The post should be well-structured with multiple sections, subheadings, and practical insights.`;

    return await generateText(`${systemPrompt}\n\n${userPrompt}`);
  } catch (error) {
    console.error('[AI Service] Error generating blog post:', error);
    throw error;
  }
}

/**
 * Improve existing blog post content
 */
export async function improveBlogContent(content: string): Promise<string> {
  try {
    const systemPrompt =
      'You are an expert content editor. Improve the given blog post by enhancing clarity, SEO optimization, readability, and engagement. Keep the same general structure but make it better.';
    const userPrompt = `Please improve this blog post content:\n\n${content}`;

    return await generateText(`${systemPrompt}\n\n${userPrompt}`);
  } catch (error) {
    console.error('[AI Service] Error improving blog content:', error);
    throw error;
  }
}

/**
 * Generate SEO meta description
 */
export async function generateMetaDescription(title: string, content: string): Promise<string> {
  try {
    const systemPrompt =
      'You are an SEO expert. Generate compelling meta descriptions that are exactly 150-160 characters and include the main keyword naturally.';
    const userPrompt = `Generate a meta description for a post titled "${title}". Here is a snippet of the content:\n\n${content.substring(0, 300)}`;

    const description = await generateText(`${systemPrompt}\n\n${userPrompt}`);
    // Trim to 160 characters for meta description
    return description.substring(0, 160);
  } catch (error) {
    console.error('[AI Service] Error generating meta description:', error);
    throw error;
  }
}

export async function generateSerpOptimization(
  input: SerpOptimizationInput
): Promise<{ title: string; metaDescription: string; reasoning: string }> {
  const {
    keyword,
    currentTitle,
    currentMetaDescription,
    impressions,
    clicks,
    ctr,
    position,
  } = input;

  const systemPrompt =
    'You are an SEO CRO specialist. Improve SERP CTR while preserving search intent. Return strict JSON with keys: title, metaDescription, reasoning.';
  const userPrompt = `
Keyword: ${keyword}
Current title: ${currentTitle}
Current meta description: ${currentMetaDescription}
Impressions: ${impressions}
Clicks: ${clicks}
CTR (%): ${ctr}
Average position: ${position ?? 0}

Rules:
- Title <= 60 chars.
- Meta description between 140 and 160 chars.
- Keep primary keyword naturally in title and meta.
- Avoid clickbait and false claims.
- Provide concise reasoning.
`;

  const raw = await generateText(`${systemPrompt}\n\n${userPrompt}`);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse SERP optimization JSON response.');
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    title?: string;
    metaDescription?: string;
    reasoning?: string;
  };

  const title = (parsed.title || currentTitle).trim().slice(0, 60);
  const metaRaw = (parsed.metaDescription || currentMetaDescription).trim();
  const metaDescription = metaRaw.length > 160 ? metaRaw.slice(0, 160) : metaRaw;

  return {
    title,
    metaDescription,
    reasoning: (parsed.reasoning || 'Updated for stronger SERP clarity and relevance.').trim(),
  };
}

export async function generateSocialPosts(
  input: SocialPostInput
): Promise<{
  linkedin: { content: string; hashtags: string; callToAction: string };
  x: { content: string; hashtags: string; callToAction: string };
}> {
  const { title, keyword, metaDescription, url } = input;
  const prompt = `
You are a social media SEO strategist.
Create two platform-specific promotional posts for a blog article.

Blog details:
- Title: ${title}
- Primary keyword: ${keyword}
- Summary: ${metaDescription}
- URL: ${url}

Rules:
1) Return strict JSON with keys: linkedin, x.
2) Each platform object must contain keys: content, hashtags, callToAction.
3) LinkedIn content: 500-900 characters, value-first professional tone, include keyword naturally.
4) X content: max 260 characters, concise hook, include keyword naturally.
5) hashtags: 3-6 relevant hashtags as plain text separated by spaces.
6) callToAction: one short CTA line.
7) Do not use markdown formatting.
`;

  const raw = await generateText(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse social post generation response.');
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    linkedin?: { content?: string; hashtags?: string; callToAction?: string };
    x?: { content?: string; hashtags?: string; callToAction?: string };
  };

  const linkedin = parsed.linkedin || {};
  const x = parsed.x || {};
  return {
    linkedin: {
      content: (linkedin.content || `${title}\n\n${metaDescription}\n\n${url}`).trim(),
      hashtags: (linkedin.hashtags || '#seo #contentmarketing #ai').trim(),
      callToAction: (linkedin.callToAction || 'Read and share your thoughts.').trim(),
    },
    x: {
      content: (x.content || `${title} ${url}`).trim().slice(0, 260),
      hashtags: (x.hashtags || '#seo #ai').trim(),
      callToAction: (x.callToAction || 'Read now.').trim(),
    },
  };
}
