import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initializing database...');
  
  try {
    // Test connection
    await prisma.$executeRawUnsafe('SELECT 1');
    console.log('✓ Database connection successful');
    
    // Create initial sample data if needed
    const keywordCount = await prisma.keyword.count();
    if (keywordCount === 0) {
      console.log('✓ Database is ready for use');
    }
    
  } catch (error) {
    console.error('✗ Database error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
