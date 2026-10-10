export async function run() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  console.log('Users in DB:');
  console.log(users.map(u => u.email));
  await prisma.$disconnect();
}
