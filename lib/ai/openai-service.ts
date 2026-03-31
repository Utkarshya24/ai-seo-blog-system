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
}

export interface BlogPrompt {
  keyword: string;
  title: string;
  tone?: string;
  maxTokens?: number;
}

/**
 * Generate SEO keywords for a given niche
 */
export async function generateKeywords(prompt: KeywordPrompt): Promise<string[]> {
  const { niche, count = 5 } = prompt;

  try {
    const systemPrompt =
      'You are an SEO expert. Generate high-quality, long-tail keywords that are relevant and have good search volume. Return only the keywords as a JSON array of strings.';
    const userPrompt = `Generate ${count} SEO-friendly keywords for the niche: "${niche}". Return as JSON array.`;

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
