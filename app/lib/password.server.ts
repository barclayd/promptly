// PBKDF2 password hashing for Cloudflare Workers
// Uses Web Crypto API which is native to Cloudflare Workers (no WASM overhead)
// Based on https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html

const ITERATIONS = 100000; // Max allowed by crypto.subtle on Cloudflare
const SALT_LENGTH = 16;
const HASH_LENGTH = 32; // 256 bits

const toHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const fromHex = (hex: string): ArrayBuffer => {
  const matches = hex.match(/.{1,2}/g) || [];
  const bytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
  return bytes.buffer as ArrayBuffer;
};

export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const saltArray = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const saltBuffer = saltArray.buffer as ArrayBuffer;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  // Format: saltHex:hashHex
  return `${toHex(saltBuffer)}:${toHex(hash)}`;
};

export const verifyPassword = async ({
  password,
  hash: storedHash,
}: {
  password: string;
  hash: string;
}): Promise<boolean> => {
  // Handle legacy Scrypt hashes (Better Auth default format)
  // Scrypt hashes from Better Auth are longer and don't follow our saltHex:hashHex format
  // Our format: 32 chars (salt) + 1 (:) + 64 chars (hash) = 97 chars
  if (!storedHash.includes(':') || storedHash.length > 100) {
    // This is likely a Scrypt hash - user needs to reset password
    console.warn('Legacy Scrypt hash detected - user needs password reset');
    return false;
  }

  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const encoder = new TextEncoder();
  const saltBuffer = fromHex(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  return toHex(hash) === hashHex;
};
