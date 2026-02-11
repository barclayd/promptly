const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;
const VERSION_PREFIX = 'v1:';

const hexToBuffer = (hex: string): ArrayBuffer => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
};

const importKey = async (keyHex: string): Promise<CryptoKey> => {
  const keyBuffer = hexToBuffer(keyHex);
  return crypto.subtle.importKey('raw', keyBuffer, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ]);
};

export const encryptApiKey = async (
  plaintext: string,
  encryptionKeyHex: string,
): Promise<string> => {
  const key = await importKey(encryptionKeyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  // Combine IV + ciphertext (GCM auth tag is appended automatically)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  const base64 = btoa(String.fromCharCode(...combined));
  return `${VERSION_PREFIX}${base64}`;
};

export const decryptApiKey = async (
  encrypted: string,
  encryptionKeyHex: string,
): Promise<string> => {
  if (!encrypted.startsWith(VERSION_PREFIX)) {
    throw new Error('Unsupported encryption version');
  }

  const base64 = encrypted.slice(VERSION_PREFIX.length);
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const key = await importKey(encryptionKeyHex);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
};

export const getKeyHint = (apiKey: string): string => {
  return apiKey.slice(-4);
};
