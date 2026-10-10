export async function run() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const API_URL = 'http://localhost:4000/api/v1';

  async function cleanup() {
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-signup' } }
    });
  }

  await cleanup();
  console.log('--- STARTING TESTS PART 1 ---');

  // Test 1: Successful signup
  const email1 = 'test-signup1@example.com';
  const res1 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'TubeX Test User', email: email1, password: 'StrongPassword123' })
  });
  const data1 = await res1.json();
  console.log('Test 1 - Success HTTP 201:', res1.status === 201 && data1.success === true && !!data1.data.user && !!data1.data.accessToken && !data1.data.user.password && !data1.data.user.passwordHash);

  // Test 2: Password is actually hashed
  const user1 = await prisma.user.findUnique({ where: { email: email1 } });
  console.log('Test 2 - Password Hashed:', !!user1 && !!user1.passwordHash && user1.passwordHash !== 'StrongPassword123' && user1.passwordHash.startsWith('$2'));

  // Test 3: JWT is valid
  try {
    const { verifyAccessToken } = await import('./dist/utils/auth/jwt.js');
    const decoded = verifyAccessToken(data1.data.accessToken);
    console.log('Test 3 - JWT Valid:', decoded.sub === user1?.id && decoded.role === 'USER' && !decoded.password && !decoded.passwordHash && !decoded.JWT_ACCESS_SECRET);
  } catch (e) {
    console.log('Test 3 - JWT Valid: false', e);
  }

  // Test 4: Email normalization
  const res4 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Normalization', email: '  TuBeX.TeSt-signup4@Example.COM  ', password: 'StrongPassword123' })
  });
  const body4 = await res4.json();
  console.log('DEBUG 4 status:', res4.status, 'body:', body4);
  const user4 = await prisma.user.findUnique({ where: { email: 'tubex.test-signup4@example.com' } });
  console.log('DEBUG 4 user:', user4);
  console.log('Test 4 - Email Normalization:', res4.status === 201 && !!user4);

  // Test 5: Duplicate email
  const res5 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate Test', email: 'tubex.test-signup4@example.com', password: 'StrongPassword123' })
  });
  console.log('Test 5 - Duplicate email (HTTP 409):', res5.status === 409);

  // Test 6: Case-insensitive duplicate
  const res6 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate Test Case', email: 'TUBEX.TEST-signup4@EXAMPLE.com', password: 'StrongPassword123' })
  });
  console.log('Test 6 - Case-insensitive duplicate (HTTP 409):', res6.status === 409);

  // Test 7: Invalid email
  const res7 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Invalid Email', email: 'not-an-email', password: 'StrongPassword123' })
  });
  console.log('Test 7 - Invalid email (HTTP 400):', res7.status === 400);

  await prisma.$disconnect();
}
