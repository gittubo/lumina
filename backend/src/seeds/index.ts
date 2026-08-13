import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@lumina.dev';
const DEMO_PASSWORD = 'demo12345';

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (existing) {
    console.log(`Demo user already exists (${DEMO_EMAIL}) — skipping.`);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, salt);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      password: hashedPassword,
    },
  });

  const project = await prisma.project.create({
    data: {
      title: 'My First Project',
      description: 'A sample project created by the seed script',
      userId: user.id,
    },
  });

  console.log('Seed complete:');
  console.log(`  User:    ${user.email} (password: ${DEMO_PASSWORD})`);
  console.log(`  Project: "${project.title}" (${project.id})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
