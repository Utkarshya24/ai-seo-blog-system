import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateKeywords } from '@/lib/ai/openai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { niche, count = 5 } = body;

    if (!niche) {
      return NextResponse.json(
        { error: 'Niche is required' },
        { status: 400 }
      );
    }

    // Generate keywords using OpenAI
    const keywords = await generateKeywords({ niche, count });

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    // Save keywords to database
    const savedKeywords = await Promise.all(
      keywords.map((keyword) =>
        prisma.keyword.create({
          data: {
            keyword,
            niche,
            status: 'pending',
            searchVolume: Math.floor(Math.random() * 5000) + 100, // Placeholder
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      keywords: savedKeywords,
      count: savedKeywords.length,
    });
  } catch (error) {
    console.error('[API] Keyword generation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate keywords',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const niche = searchParams.get('niche') || undefined;

    const keywords = await prisma.keyword.findMany({
      where: {
        ...(status && { status }),
        ...(niche && { niche }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}
