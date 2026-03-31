/**
 * Setup script for AI SEO Blog System
 * Run with: pnpm tsx scripts/setup.ts
 */

import { prisma } from '@/lib/db';

async function main() {
  console.log('🚀 Setting up AI SEO Blog System...\n');

  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connection successful!\n');

    // Create sample data
    console.log('📝 Creating sample data...');

    // Create sample niches/keywords
    const sampleNiches = ['AI Tools', 'Web Development', 'Machine Learning'];
    const keywordCounts = {
      'AI Tools': ['ChatGPT alternatives', 'AI writing tools', 'AI image generators'],
      'Web Development': ['Next.js tips', 'React hooks tutorial', 'TypeScript basics'],
      'Machine Learning': [
        'Deep learning guide',
        'Neural networks explained',
        'ML for beginners',
      ],
    };

    let keywordCount = 0;

    for (const niche of sampleNiches) {
      const keywords = keywordCounts[niche as keyof typeof keywordCounts] || [];

      for (const keyword of keywords) {
        // Check if keyword already exists
        const exists = await prisma.keyword.findFirst({
          where: { keyword },
        });

        if (!exists) {
          await prisma.keyword.create({
            data: {
              keyword,
              niche,
              status: 'pending',
              searchVolume: Math.floor(Math.random() * 5000) + 100,
            },
          });
          keywordCount++;
        }
      }
    }

    console.log(`✅ Created ${keywordCount} sample keywords\n`);

    // Show statistics
    console.log('📊 Current Statistics:');
    const stats = await Promise.all([
      prisma.keyword.count(),
      prisma.post.count(),
      prisma.post.count({ where: { status: 'published' } }),
    ]);

    console.log(`  • Total Keywords: ${stats[0]}`);
    console.log(`  • Total Posts: ${stats[1]}`);
    console.log(`  • Published Posts: ${stats[2]}\n`);

    console.log('✨ Setup complete!');
    console.log('\n📖 Next steps:');
    console.log('  1. Start the dev server: pnpm dev');
    console.log('  2. Visit http://localhost:3000');
    console.log('  3. Go to /admin/keywords to generate more keywords');
    console.log('  4. Go to /admin/posts to create blog posts');
    console.log('  5. Visit /blog to see published posts\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
