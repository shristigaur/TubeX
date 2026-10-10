export async function run() {
  const API_URL = 'http://localhost:4000/api/v1';
  const res4 = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Normalization', email: '  TuBeX.TeSt-signup4@Example.COM  ', password: 'StrongPassword123' })
  });
  console.log('res4 status:', res4.status);
  console.log('res4 body:', await res4.json());
}
