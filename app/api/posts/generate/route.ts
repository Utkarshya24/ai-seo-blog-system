import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateBlogPost, generateMetaDescription } from '@/lib/ai/openai-service';
import { generateSlug } from '@/lib/utils/seo';

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
    const slug = generateSlug(title);
    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        keywordId,
        metaDescription,
        status: 'draft',
        readingTime: Math.ceil(content.split(/\s+/).length / 200),
      },
    });

    // Update keyword status
    await prisma.keyword.update({
      where: { id: keywordId },
      data: { status: 'used' },
    });

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('[API] Blog generation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate blog post',
      },
      { status: 500 }
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

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('[API] Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
