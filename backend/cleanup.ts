export async function run() {
  const { prisma } = await import('./src/config/prisma.js');
  const res = await prisma.user.deleteMany({
    where: { email: { startsWith: 'test-user-' } }
  });
  const res2 = await prisma.user.deleteMany({
    where: { email: { startsWith: 'test-' } }
  });
  console.log('Cleaned up users:', res.count + res2.count);
}
