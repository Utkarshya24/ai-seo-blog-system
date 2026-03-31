import cron from 'node-cron';
import { prisma } from '@/lib/db';
import { generateKeywords } from '@/lib/ai/openai-service';
import { generateBlogPost, generateMetaDescription } from '@/lib/ai/openai-service';
import { generateSlug } from '@/lib/utils/seo';

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret';

interface CronJobConfig {
  schedule: string;
  name: string;
  task: () => Promise<void>;
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

/**
 * Daily keyword generation job
 */
export const dailyKeywordGenerationJob = {
  schedule: '0 0 * * *', // Every day at midnight
  name: 'Daily Keyword Generation',
  task: async () => {
    console.log('[CRON] Starting daily keyword generation job');
    try {
      const niches = ['AI tools', 'machine learning', 'web development', 'productivity'];

      for (const niche of niches) {
        const keywords = await generateKeywords({ niche, count: 3 });

        for (const keyword of keywords) {
          await prisma.keyword.upsert({
            where: { keyword },
            update: {
              searchVolume: Math.floor(Math.random() * 5000) + 100,
              updatedAt: new Date(),
            },
            create: {
              keyword,
              difficulty: Math.floor(Math.random() * 101),
              searchVolume: Math.floor(Math.random() * 5000) + 100,
            },
          });
        }

        console.log(`[CRON] Generated ${keywords.length} keywords for niche: ${niche}`);
      }

      console.log('[CRON] Daily keyword generation job completed');
    } catch (error) {
      console.error('[CRON] Error in daily keyword generation:', error);
    }
  },
};

/**
 * Weekly blog post generation and publishing job
 */
export const weeklyBlogGenerationJob = {
  schedule: '0 2 * * 1', // Every Monday at 2 AM
  name: 'Weekly Blog Generation',
  task: async () => {
    console.log('[CRON] Starting weekly blog generation job');
    try {
      // Get keywords without associated posts yet
      const pendingKeywords = await prisma.keyword.findMany({
        where: { posts: { none: {} } },
        take: 2, // Generate 2 blog posts per week
      });

      if (pendingKeywords.length === 0) {
        console.log('[CRON] No pending keywords for blog generation');
        return;
      }

      for (const keyword of pendingKeywords) {
        try {
          // Generate blog post
          const content = await generateBlogPost({
            keyword: keyword.keyword,
            title: `Everything You Need to Know About ${keyword.keyword}`,
          });

          const metaDescription = await generateMetaDescription(
            `Everything You Need to Know About ${keyword.keyword}`,
            content
          );

          const title = `Everything You Need to Know About ${keyword.keyword}`;
          const slug = await generateUniqueSlug(title);

          // Create post
          const post = await prisma.post.create({
            data: {
              title,
              content,
              slug,
              keywordId: keyword.id,
              metaDescription,
              status: 'published', // Auto-publish for cron jobs
              publishedAt: new Date(),
            },
          });

          console.log(`[CRON] Generated and published blog post: ${post.slug}`);
        } catch (error) {
          console.error(`[CRON] Error generating blog post for keyword ${keyword.keyword}:`, error);
        }
      }

      console.log('[CRON] Weekly blog generation job completed');
    } catch (error) {
      console.error('[CRON] Error in weekly blog generation:', error);
    }
  },
};

/**
 * Weekly SEO metrics update job
 */
export const weeklyMetricsUpdateJob = {
  schedule: '0 6 * * 1', // Every Monday at 6 AM
  name: 'Weekly Metrics Update',
  task: async () => {
    console.log('[CRON] Starting weekly metrics update job');
    try {
      // Get all published posts
      const posts = await prisma.post.findMany({
        where: { status: 'published' },
      });

      for (const post of posts) {
        // Simulate metrics data (in real app, fetch from Google Analytics or similar)
        const simulatedTraffic = Math.floor(Math.random() * 5000) + 200;
        const simulatedBacklinks = Math.floor(Math.random() * 60);
        const simulatedRanking = Math.floor(Math.random() * 100) + 1; // 1 is best

        await prisma.seoMetrics.upsert({
          where: { postId: post.id },
          update: {
            traffic: simulatedTraffic,
            backlinks: simulatedBacklinks,
            ranking: simulatedRanking,
            updatedAt: new Date(),
          },
          create: {
            postId: post.id,
            traffic: simulatedTraffic,
            backlinks: simulatedBacklinks,
            ranking: simulatedRanking,
          },
        });
      }

      console.log(`[CRON] Updated metrics for ${posts.length} posts`);
      console.log('[CRON] Weekly metrics update job completed');
    } catch (error) {
      console.error('[CRON] Error in weekly metrics update:', error);
    }
  },
};

// Store registered jobs
const registeredJobs: cron.ScheduledTask[] = [];

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  const jobs = [
    dailyKeywordGenerationJob,
    weeklyBlogGenerationJob,
    weeklyMetricsUpdateJob,
  ];

  jobs.forEach((jobConfig) => {
    try {
      const task = cron.schedule(jobConfig.schedule, jobConfig.task, {
        runOnInit: false, // Don't run on init
      });

      registeredJobs.push(task);
      console.log(`[CRON] Scheduled job: ${jobConfig.name} (${jobConfig.schedule})`);
    } catch (error) {
      console.error(`[CRON] Error scheduling job ${jobConfig.name}:`, error);
    }
  });

  console.log(`[CRON] Initialized ${registeredJobs.length} cron jobs`);
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs() {
  registeredJobs.forEach((task) => task.stop());
  console.log('[CRON] Stopped all cron jobs');
}

/**
 * Validate cron job request
 */
export function validateCronRequest(secret: string): boolean {
  return secret === CRON_SECRET;
}
