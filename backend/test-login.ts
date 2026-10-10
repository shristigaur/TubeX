import { randomUUID } from 'crypto';

const BASE_URL = 'http://localhost:4000/api/v1';
const uuid = randomUUID();
const TEST_EMAIL = `test-user-${uuid}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

async function runTests() {
  console.log('Starting tests...');

  // Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  console.log('Health check:', healthRes.status === 200 ? 'PASS' : 'FAIL');

  // Signup
  const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  console.log('Signup test:', signupRes.status === 201 ? 'PASS' : 'FAIL');

  // Test 1: Correct email and password
  const loginRes1 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  });
  const data1 = await loginRes1.json();
  console.log('Test 1 - Correct credentials (200):', loginRes1.status === 200 ? 'PASS' : 'FAIL');
  
  // Test 2 & 15: Valid token and no sensitive info
  console.log('Test 2 & 15 - Token valid & no sensitive info:', (data1.data.accessToken && !data1.data.user.passwordHash && !data1.data.user.googleId) ? 'PASS' : 'FAIL');

  // Test 4: Uppercase email
  const loginRes4 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL.toUpperCase(), password: TEST_PASSWORD })
  });
  console.log('Test 4 - Uppercase email:', loginRes4.status === 200 ? 'PASS' : 'FAIL');

  // Test 5: Email with whitespace
  const loginRes5 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `  ${TEST_EMAIL}  `, password: TEST_PASSWORD })
  });
  console.log('Test 5 - Whitespace email:', loginRes5.status === 200 ? 'PASS' : 'FAIL');

  // Test 6: Incorrect password
  const loginRes6 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: 'WrongPassword123' })
  });
  console.log('Test 6 - Incorrect password (401):', loginRes6.status === 401 ? 'PASS' : 'FAIL');

  // Test 7: Unknown email
  const loginRes7 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown-xxx@example.com', password: TEST_PASSWORD })
  });
  console.log('Test 7 - Unknown email (401):', loginRes7.status === 401 ? 'PASS' : 'FAIL');
  
  // Test 9: Missing email
  const loginRes9 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: TEST_PASSWORD })
  });
  console.log('Test 9 - Missing email (400):', loginRes9.status === 400 ? 'PASS' : 'FAIL');

  // Test 10: Missing password
  const loginRes10 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL })
  });
  console.log('Test 10 - Missing password (400):', loginRes10.status === 400 ? 'PASS' : 'FAIL');
  
  // Test 11: Invalid email
  const loginRes11 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: TEST_PASSWORD })
  });
  console.log('Test 11 - Invalid email (400):', loginRes11.status === 400 ? 'PASS' : 'FAIL');

  // Test 13: Role injection
  const loginRes13 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, role: 'ADMIN' })
  });
  const data13 = await loginRes13.json();
  console.log('Test 13 - Role injection prevented:', data13.data?.user?.role === 'USER' ? 'PASS' : 'FAIL');
}

runTests().catch(console.error);
