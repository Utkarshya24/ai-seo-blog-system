import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateBlogPost, generateMetaDescription } from '@/lib/ai/openai-service';
import { generateSlug } from '@/lib/utils/seo';

function getErrorStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    if (!Number.isNaN(status) && status >= 400 && status < 600) return status;
  }
  if (error instanceof Error && error.message.includes('429')) return 429;
  return 500;
}

function getUserFacingError(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 429) {
    return 'Gemini quota/rate limit exceeded. Retry shortly or use a key/project with available quota.';
  }
  return error instanceof Error ? error.message : 'Failed to generate blog post';
}

function calculateReadingTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = generateSlug(title);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywordId, title, tone = 'professional' } = body;

    if (!keywordId || !title) {
      return NextResponse.json(
        { error: 'keywordId and title are required' },
        { status: 400 }
      );
    }

    // Fetch keyword
    const keyword = await prisma.keyword.findUnique({
      where: { id: keywordId },
    });

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword not found' },
        { status: 404 }
      );
    }

    // Generate blog content
    const content = await generateBlogPost({
      keyword: keyword.keyword,
      title,
      tone,
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate blog post' },
        { status: 500 }
      );
    }

    // Generate meta description
    const metaDescription = await generateMetaDescription(title, content);

    // Create post in database
    const slug = await generateUniqueSlug(title);
    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        keywordId,
        metaDescription,
        status: 'draft',
      },
      include: {
        keyword: true,
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        readingTime: calculateReadingTime(post.content),
      },
    });
  } catch (error) {
    console.error('[API] Blog generation error:', error);
    return NextResponse.json(
      { error: getUserFacingError(error) },
      { status: getErrorStatus(error) }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const keywordId = searchParams.get('keywordId') || undefined;

    const posts = await prisma.post.findMany({
      where: {
        ...(status && { status }),
        ...(keywordId && { keywordId }),
      },
      include: {
        keyword: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        readingTime: calculateReadingTime(post.content),
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
