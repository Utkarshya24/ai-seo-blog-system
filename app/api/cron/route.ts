import { NextRequest, NextResponse } from 'next/server';
import {
  validateCronRequest,
  dailyKeywordGenerationJob,
  weeklyBlogGenerationJob,
  weeklyMetricsUpdateJob,
  weeklyContentRefreshJob,
  techTrendsRefreshJob,
} from '@/lib/cron/cron-service';

export async function POST(request: NextRequest) {
  try {
    const { secret, job } = await request.json();

    // Validate cron secret
    if (!validateCronRequest(secret)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let result;

    switch (job) {
      case 'generate-keywords':
        await dailyKeywordGenerationJob.task();
        result = 'Daily keyword generation completed';
        break;

      case 'generate-blog':
        await weeklyBlogGenerationJob.task();
        result = 'Blog generation completed';
        break;

      case 'update-metrics':
        await weeklyMetricsUpdateJob.task();
        result = 'Metrics update completed';
        break;

      case 'refresh-content':
        await weeklyContentRefreshJob.task();
        result = 'Content refresh completed';
        break;

      case 'tech-trends':
        await techTrendsRefreshJob.task();
        result = 'Tech trends refresh completed';
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown job type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error('[CRON API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Cron job failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const job = searchParams.get('job');

  if (!secret || !job) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Validate cron secret
  if (!validateCronRequest(secret)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let result;

  try {
    switch (job) {
      case 'generate-keywords':
        await dailyKeywordGenerationJob.task();
        result = 'Daily keyword generation completed';
        break;

      case 'generate-blog':
        await weeklyBlogGenerationJob.task();
        result = 'Blog generation completed';
        break;

      case 'update-metrics':
        await weeklyMetricsUpdateJob.task();
        result = 'Metrics update completed';
        break;

      case 'refresh-content':
        await weeklyContentRefreshJob.task();
        result = 'Content refresh completed';
        break;

      case 'tech-trends':
        await techTrendsRefreshJob.task();
        result = 'Tech trends refresh completed';
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown job type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error('[CRON API] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Cron job failed',
      },
      { status: 500 }
    );
  }
}
