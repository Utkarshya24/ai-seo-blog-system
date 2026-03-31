import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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

    const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const content = response.response.text();

    if (!content) return [];

    // Extract JSON array from response
    const jsonMatch = content.match(/\[.*\]/s);
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

    const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    return response.response.text() || '';
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

    const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    return response.response.text() || '';
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

    const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const description = response.response.text() || '';
    // Trim to 160 characters for meta description
    return description.substring(0, 160);
  } catch (error) {
    console.error('[AI Service] Error generating meta description:', error);
    throw error;
  }
}
