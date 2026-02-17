import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importPKCS8, SignJWT } from 'jose';

const APPLE_AUTH_URL = 'https://appleid.apple.com';
const MAX_LIFETIME_SECONDS = 15777000; // ~6 months (Apple's max)
const DEFAULT_LIFETIME_SECONDS = 15552000; // 180 days

const teamId = process.env.APPLE_TEAM_ID;
const keyId = process.env.APPLE_KEY_ID;
const clientId = process.env.APPLE_CLIENT_ID;
const keyPath = process.argv[2];

if (!teamId || !keyId || !clientId || !keyPath) {
  console.error(`Usage:
  APPLE_TEAM_ID=<team_id> \\
  APPLE_KEY_ID=<key_id> \\
  APPLE_CLIENT_ID=<client_id> \\
  bun run apple-secret ./AuthKey_<key_id>.p8
`);
  process.exit(1);
}

const absolutePath = resolve(keyPath);
const privateKeyPem = readFileSync(absolutePath, 'utf-8');

const privateKey = await importPKCS8(privateKeyPem, 'ES256');

const now = Math.floor(Date.now() / 1000);
const exp = now + DEFAULT_LIFETIME_SECONDS;

if (DEFAULT_LIFETIME_SECONDS > MAX_LIFETIME_SECONDS) {
  console.error(
    'Error: Apple client secrets cannot exceed ~6 months validity.',
  );
  process.exit(1);
}

const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: keyId })
  .setIssuer(teamId)
  .setIssuedAt(now)
  .setExpirationTime(exp)
  .setAudience(APPLE_AUTH_URL)
  .setSubject(clientId)
  .sign(privateKey);

const expiryDate = new Date(exp * 1000);

console.log('\nApple Client Secret (JWT):');
console.log(jwt);
console.log(
  `\nExpires: ${expiryDate.toISOString()} (${expiryDate.toLocaleDateString('en-GB', { dateStyle: 'long' })})`,
);
console.log(
  '\nSet this as APPLE_CLIENT_SECRET in your .env and Cloudflare Dashboard.',
);
console.log('Reminder: Regenerate before expiry (~5 months from now).');
