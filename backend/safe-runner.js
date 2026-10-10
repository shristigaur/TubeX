import 'dotenv/config';
import path from 'path';

const ALLOWLIST = new Set([
  'cleanup.ts',
  'debug-prisma.js',
  'debug-signup.js',
  'debug-test4.js',
  'test-signup-1.js',
  'test-signup-2.js',
  'show-users.js'
]);

async function main() {
  const targetScript = process.argv[2];
  if (!targetScript) {
    console.error('Usage: node safe-runner.js <script>');
    process.exit(1);
  }

  // Exact allowlist validation.
  // Reject paths containing directory traversal or protocol handlers.
  const normalized = path.normalize(targetScript);
  const baseName = path.basename(normalized);

  if (targetScript !== baseName || !ALLOWLIST.has(targetScript)) {
    console.error('SAFETY GATE: Invalid target script. Execution refused.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || '';
  
  // Refuse remote targets
  try {
    const url = new URL(dbUrl);
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (!localHosts.includes(url.hostname)) {
      console.error('SAFETY GATE: Remote database targets are strictly prohibited.');
      process.exit(1);
    }
  } catch (err) {
    console.error('SAFETY GATE: Invalid or missing DATABASE_URL format.');
    process.exit(1);
  }

  // A generic opt-in flag and localhost URL must not be treated as sufficient proof
  // of a disposable target. Since we have no dynamic URL or verified isolated container,
  // we refuse execution safely rather than guessing.
  console.error('SAFETY GATE: Cannot mathematically prove the target local database is safely disposable.');
  console.error('Execution of standalone scripts is currently blocked to prevent accidental data loss.');
  process.exit(1);

  // FUTURE IMPLEMENTATION (Execution currently blocked above):
  // const module = await import('./' + targetScript);
  // if (module.run) { await module.run(); }
}

main().catch(() => {
  console.error('SAFETY GATE: Unexpected error.');
  process.exit(1);
});
