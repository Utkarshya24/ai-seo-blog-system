import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (postId) {
      const metrics = await prisma.seoMetrics.findUnique({
        where: { postId },
      });

      if (!metrics) {
        return NextResponse.json(
          { error: 'Metrics not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(metrics);
    }

    // Get all metrics
    const allMetrics = await prisma.seoMetrics.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ metrics: allMetrics });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, views = 0, clicks = 0, avgTimeOnPage = 0, bounceRate = 0 } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }

    const metrics = await prisma.seoMetrics.upsert({
      where: { postId },
      update: {
        views,
        clicks,
        avgTimeOnPage,
        bounceRate,
        updatedAt: new Date(),
      },
      create: {
        postId,
        views,
        clicks,
        avgTimeOnPage,
        bounceRate,
      },
    });

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('[API] Error updating metrics:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update metrics',
      },
      { status: 500 }
    );
  }
}
