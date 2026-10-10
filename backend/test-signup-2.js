export async function run() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const API_URL = 'http://localhost:4000/api/v1';

  console.log('--- STARTING TESTS PART 2 ---');

  // Test 8: Missing name
  const res8 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-signup8@example.com', password: 'StrongPassword123' })
  });
  console.log('Test 8 - Missing name (HTTP 400):', res8.status === 400);

  // Test 9: Missing password
  const res9 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Missing Password', email: 'test-signup9@example.com' })
  });
  console.log('Test 9 - Missing password (HTTP 400):', res9.status === 400);

  // Test 10: Weak password
  const res10 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Weak Password', email: 'test-signup10@example.com', password: 'weak' })
  });
  console.log('Test 10 - Weak password (HTTP 400):', res10.status === 400);

  // Test 11: Whitespace name
  const res11 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', email: 'test-signup11@example.com', password: 'StrongPassword123' })
  });
  console.log('Test 11 - Whitespace name (HTTP 400):', res11.status === 400);

  // Test 12: Role escalation protection
  const email12 = 'test-signup12@example.com';
  const res12 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Role Escalation', email: email12, password: 'StrongPassword123', role: 'ADMIN' })
  });
  const user12 = await prisma.user.findUnique({ where: { email: email12 } });
  console.log('Test 12 - Role escalation protection:', (res12.status === 201) && !!user12 && user12.role === 'USER');

  // Test 13: Protected-field injection
  const email13 = 'test-signup13@example.com';
  const res13 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Injection', email: email13, password: 'StrongPassword123', passwordHash: 'fake-hash', googleId: 'fake-google-id' })
  });
  const user13 = await prisma.user.findUnique({ where: { email: email13 } });
  console.log('Test 13 - Protected-field injection:', (res13.status === 201) && !!user13 && user13.passwordHash !== 'fake-hash' && user13.googleId !== 'fake-google-id');

  await prisma.user.deleteMany({
    where: { email: { contains: 'test-signup' } }
  });
  console.log('--- CLEANUP COMPLETE ---');
  await prisma.$disconnect();
}
