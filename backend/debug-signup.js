export async function run() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const API_URL = 'http://localhost:4000/api/v1';
  const email4 = '  TuBeX.TeSt-signup4@Example.COM  ';
  const res4 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Normalization', email: email4, password: 'StrongPassword123' })
  });
  console.log('res4 status:', res4.status);
  console.log('res4 body:', await res4.json());

  const email12 = 'test-signup12@example.com';
  const res12 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Role Escalation', email: email12, password: 'StrongPassword123', role: 'ADMIN' })
  });
  console.log('res12 status:', res12.status);
  console.log('res12 body:', await res12.json());

  const user12 = await prisma.user.findUnique({ where: { email: email12 } });
  console.log('user12:', user12);

  await prisma.user.deleteMany({
    where: { email: { contains: 'test-signup' } }
  });
}
