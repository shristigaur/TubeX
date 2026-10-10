export async function run() {
  const { PrismaClient, Prisma } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.user.create({
      data: {
        name: 'Debug User 2',
        email: 'debug2@example.com',
        passwordHash: 'hash',
        role: 'USER',
      },
    });
    console.log('Inserted debug2');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.log('P2002 Error on:', error.meta?.target);
    } else {
      console.log('Error:', error);
    }
  }
  await prisma.$disconnect();
}
