import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs'; // Ensure this line is present

const prisma = new PrismaClient();

async function main() {
  // Pull credentials directly from your .env for consistency
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@eialm.internal';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'System Administrator',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`✅ Admin user verified: ${adminEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });