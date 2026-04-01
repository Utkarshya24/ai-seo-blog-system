import cron from 'node-cron';
import { prisma } from '@/lib/db';
import { generateComparisonKeywords, generateKeywords } from '@/lib/ai/openai-service';
import {
  generateBlogPost,
  generateMetaDescription,
  generateSerpOptimization,
  improveBlogContent,
} from '@/lib/ai/openai-service';
import { generateSlug, toSeoTitle } from '@/lib/utils/seo';
import { syncSearchConsoleMetrics } from '@/lib/integrations/google-search-console';

const CRON_SECRET = process.env.CRON_SECRET || 'default-secret';
const KEYWORDS_PER_NICHE = Number(process.env.KEYWORDS_PER_NICHE || 4);
const COMPARISON_KEYWORDS_PER_NICHE = Number(process.env.COMPARISON_KEYWORDS_PER_NICHE || 2);
const BLOG_GENERATION_BATCH_SIZE = Number(process.env.BLOG_GENERATION_BATCH_SIZE || 8);
const AUTO_PUBLISH_GENERATED_POSTS = process.env.AUTO_PUBLISH_GENERATED_POSTS !== 'false';
const BLOG_GENERATION_SCHEDULE = process.env.BLOG_GENERATION_SCHEDULE || '0 2 * * *';
const METRICS_UPDATE_SCHEDULE = process.env.METRICS_UPDATE_SCHEDULE || '0 6 * * *';
const CONTENT_REFRESH_SCHEDULE = process.env.CONTENT_REFRESH_SCHEDULE || '30 6 * * 1';
const CONTENT_REFRESH_BATCH_SIZE = Number(process.env.CONTENT_REFRESH_BATCH_SIZE || 4);
const CONTENT_REFRESH_MIN_IMPRESSIONS = Number(process.env.CONTENT_REFRESH_MIN_IMPRESSIONS || 200);
const CONTENT_REFRESH_MAX_CTR = Number(process.env.CONTENT_REFRESH_MAX_CTR || 2.5);
const CONTENT_REFRESH_MIN_POSITION = Number(process.env.CONTENT_REFRESH_MIN_POSITION || 14);
const CONTENT_REFRESH_MIN_AGE_DAYS = Number(process.env.CONTENT_REFRESH_MIN_AGE_DAYS || 14);
const GSC_SITE_URL = process.env.GSC_SITE_URL;
const GSC_TOKEN = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || null;
const DEFAULT_WEBSITE_ID = process.env.DEFAULT_WEBSITE_ID || null;

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
        const [keywords, comparisonKeywords] = await Promise.all([
          generateKeywords({ niche, count: KEYWORDS_PER_NICHE, includeComparison: true }),
          generateComparisonKeywords({ niche, count: COMPARISON_KEYWORDS_PER_NICHE }),
        ]);
        const allKeywords = Array.from(new Set([...keywords, ...comparisonKeywords]));

        for (const keyword of allKeywords) {
          const existing = await prisma.keyword.findFirst({
            where: { keyword, websiteId: DEFAULT_WEBSITE_ID },
          });

          if (existing) {
            await prisma.keyword.update({
              where: { id: existing.id },
              data: {
                niche,
                tenantId: DEFAULT_TENANT_ID,
                websiteId: DEFAULT_WEBSITE_ID,
                searchVolume: Math.floor(Math.random() * 5000) + 100,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.keyword.create({
              data: {
                keyword,
                niche,
                tenantId: DEFAULT_TENANT_ID,
                websiteId: DEFAULT_WEBSITE_ID,
                difficulty: Math.floor(Math.random() * 101),
                searchVolume: Math.floor(Math.random() * 5000) + 100,
              },
            });
          }
        }

        console.log(`[CRON] Generated ${allKeywords.length} keywords for niche: ${niche}`);
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
  schedule: BLOG_GENERATION_SCHEDULE,
  name: 'Blog Generation',
  task: async () => {
    console.log('[CRON] Starting blog generation job');
    try {
      const comparisonKeywords = await prisma.keyword.findMany({
        where: {
          ...(DEFAULT_TENANT_ID && { tenantId: DEFAULT_TENANT_ID }),
          ...(DEFAULT_WEBSITE_ID && { websiteId: DEFAULT_WEBSITE_ID }),
          posts: { none: {} },
          keyword: { contains: ' vs ', mode: 'insensitive' },
        },
        take: BLOG_GENERATION_BATCH_SIZE,
      });
      const remainingSlots = Math.max(0, BLOG_GENERATION_BATCH_SIZE - comparisonKeywords.length);
      const genericKeywords = remainingSlots > 0
        ? await prisma.keyword.findMany({
            where: {
              ...(DEFAULT_TENANT_ID && { tenantId: DEFAULT_TENANT_ID }),
              ...(DEFAULT_WEBSITE_ID && { websiteId: DEFAULT_WEBSITE_ID }),
              posts: { none: {} },
              NOT: { keyword: { contains: ' vs ' } },
            },
            take: remainingSlots,
          })
        : [];
      const pendingKeywords = [...comparisonKeywords, ...genericKeywords];

      if (pendingKeywords.length === 0) {
        console.log('[CRON] No pending keywords for blog generation');
        return;
      }

      for (const keyword of pendingKeywords) {
        try {
          const template = /\bvs\b/i.test(keyword.keyword)
            ? `${keyword.keyword}: Which Option Is Better in 2026?`
            : `Everything You Need to Know About ${keyword.keyword}`;
          const title = toSeoTitle(template);

          const content = await generateBlogPost({
            keyword: keyword.keyword,
            title,
          });

          const metaDescription = await generateMetaDescription(
            title,
            content
          );

          const slug = await generateUniqueSlug(title);

          const post = await prisma.post.create({
            data: {
              title,
              content,
              slug,
              keywordId: keyword.id,
              tenantId: keyword.tenantId,
              websiteId: keyword.websiteId,
              metaDescription,
              status: AUTO_PUBLISH_GENERATED_POSTS ? 'published' : 'draft',
              publishedAt: AUTO_PUBLISH_GENERATED_POSTS ? new Date() : null,
            },
          });

          console.log(`[CRON] Generated ${AUTO_PUBLISH_GENERATED_POSTS ? 'and published' : 'draft'} post: ${post.slug}`);
        } catch (error) {
          console.error(`[CRON] Error generating blog post for keyword ${keyword.keyword}:`, error);
        }
      }

      console.log('[CRON] Blog generation job completed');
    } catch (error) {
      console.error('[CRON] Error in blog generation:', error);
    }
  },
};

/**
 * Metrics update job
 */
export const weeklyMetricsUpdateJob = {
  schedule: METRICS_UPDATE_SCHEDULE,
  name: 'Metrics Update',
  task: async () => {
    console.log('[CRON] Starting metrics update job');
    try {
      if (GSC_SITE_URL && GSC_TOKEN) {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - 1);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);

        const result = await syncSearchConsoleMetrics({
          siteUrl: GSC_SITE_URL,
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          accessToken: GSC_TOKEN,
          rowLimit: 2000,
          tenantId: DEFAULT_TENANT_ID,
          websiteId: DEFAULT_WEBSITE_ID,
        });

        console.log(`[CRON] GSC sync completed. Updated ${result.updatedPosts} posts.`);
        return;
      }

      // Fallback for environments without GSC integration configured.
      const posts = await prisma.post.findMany({
        where: {
          status: 'published',
          ...(DEFAULT_TENANT_ID && { tenantId: DEFAULT_TENANT_ID }),
          ...(DEFAULT_WEBSITE_ID && { websiteId: DEFAULT_WEBSITE_ID }),
        },
        take: BLOG_GENERATION_BATCH_SIZE,
      });

      for (const post of posts) {
        const simulatedImpressions = Math.floor(Math.random() * 5000) + 200;
        const simulatedClicks = Math.max(1, Math.floor(simulatedImpressions * (Math.random() * 0.09 + 0.01)));
        const simulatedCtr = Number(((simulatedClicks / simulatedImpressions) * 100).toFixed(2));
        const simulatedPosition = Number((Math.random() * 60 + 1).toFixed(2));
        const simulatedBacklinks = Math.floor(Math.random() * 60);

        await prisma.seoMetrics.upsert({
          where: { postId: post.id },
          update: {
            tenantId: post.tenantId,
            websiteId: post.websiteId,
            traffic: simulatedImpressions,
            impressions: simulatedImpressions,
            clicks: simulatedClicks,
            ctr: simulatedCtr,
            backlinks: simulatedBacklinks,
            ranking: Math.round(simulatedPosition),
            position: simulatedPosition,
            source: 'simulated',
            fetchedAt: new Date(),
            updatedAt: new Date(),
          },
          create: {
            postId: post.id,
            tenantId: post.tenantId,
            websiteId: post.websiteId,
            traffic: simulatedImpressions,
            impressions: simulatedImpressions,
            clicks: simulatedClicks,
            ctr: simulatedCtr,
            backlinks: simulatedBacklinks,
            ranking: Math.round(simulatedPosition),
            position: simulatedPosition,
            source: 'simulated',
          },
        });
      }

      console.log(`[CRON] Updated fallback metrics for ${posts.length} posts`);
      console.log('[CRON] Metrics update job completed');
    } catch (error) {
      console.error('[CRON] Error in metrics update:', error);
    }
  },
};

/**
 * Weekly declining-content refresh job
 */
export const weeklyContentRefreshJob = {
  schedule: CONTENT_REFRESH_SCHEDULE,
  name: 'Content Refresh',
  task: async () => {
    console.log('[CRON] Starting content refresh job');

    try {
      const minPostAgeDate = new Date();
      minPostAgeDate.setDate(minPostAgeDate.getDate() - CONTENT_REFRESH_MIN_AGE_DAYS);

      const candidates = await prisma.seoMetrics.findMany({
        where: {
          impressions: { gte: CONTENT_REFRESH_MIN_IMPRESSIONS },
          OR: [
            { ctr: { lte: CONTENT_REFRESH_MAX_CTR } },
            { position: { gte: CONTENT_REFRESH_MIN_POSITION } },
          ],
          post: {
            status: 'published',
            updatedAt: { lte: minPostAgeDate },
            ...(DEFAULT_TENANT_ID && { tenantId: DEFAULT_TENANT_ID }),
            ...(DEFAULT_WEBSITE_ID && { websiteId: DEFAULT_WEBSITE_ID }),
          },
        },
        include: {
          post: {
            include: {
              keyword: true,
            },
          },
        },
        orderBy: [{ impressions: 'desc' }, { updatedAt: 'asc' }],
        take: CONTENT_REFRESH_BATCH_SIZE,
      });

      if (candidates.length === 0) {
        console.log('[CRON] No declining posts found for content refresh');
        return;
      }

      let refreshed = 0;
      for (const row of candidates) {
        const post = row.post;
        if (!post) continue;

        try {
          const optimized = await generateSerpOptimization({
            keyword: post.keyword?.keyword || post.title,
            currentTitle: post.title,
            currentMetaDescription: post.metaDescription,
            impressions: row.impressions || row.traffic || 0,
            clicks: row.clicks || 0,
            ctr: row.ctr || 0,
            position: row.position || row.ranking || 0,
          });
          const improvedContent = await improveBlogContent(post.content);

          await prisma.post.update({
            where: { id: post.id },
            data: {
              title: toSeoTitle(optimized.title),
              metaDescription: optimized.metaDescription,
              content: improvedContent || post.content,
              updatedAt: new Date(),
            },
          });

          refreshed += 1;
          console.log(
            `[CRON] Refreshed post ${post.slug} (impr=${row.impressions}, ctr=${row.ctr}, pos=${row.position})`
          );
        } catch (error) {
          console.error(`[CRON] Failed to refresh post ${post.slug}:`, error);
        }
      }

      console.log(`[CRON] Content refresh job completed. Refreshed ${refreshed} posts.`);
    } catch (error) {
      console.error('[CRON] Error in content refresh job:', error);
    }
  },
};

// Store registered jobs
const registeredJobs: cron.ScheduledTask[] = [];

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  const jobs: CronJobConfig[] = [
    dailyKeywordGenerationJob,
    weeklyBlogGenerationJob,
    weeklyMetricsUpdateJob,
    weeklyContentRefreshJob,
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
