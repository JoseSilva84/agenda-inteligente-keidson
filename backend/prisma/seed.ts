import bcrypt from 'bcryptjs';
import { prisma, DEFAULT_CATEGORIES } from '../src/lib/db';

async function main() {
  const email = 'keidson@agendainteligente.com';
  const passwordHash = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: 'Keidson',
      email,
      passwordHash,
      role: 'owner',
      theme: 'dark',
      settings: {
        create: {
          mode: 'confirm',
          workStart: '08:00',
          workEnd: '18:00',
          workDays: [1, 2, 3, 4, 5],
          categories: DEFAULT_CATEGORIES,
          specialCats: true
        }
      }
    }
  });

  console.log('✅ Usuário proprietário semeado no PostgreSQL:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
