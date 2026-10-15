/**
 * WebCrypto AES-256-GCM authenticated encryption primitives for LunaClair.
 *
 * Provides stateless token sealing and unsealing using AES-256-GCM.
 * User Google `sub` is bound as Additional Authenticated Data (AAD)
 * to prevent token transplantation across accounts.
 */

const IV_LENGTH_BYTES = 12; // 96-bit standard IV for AES-GCM
const TAG_LENGTH_BITS = 128; // 128-bit authentication tag
const MIN_COMBINED_PAYLOAD_BYTES = IV_LENGTH_BYTES + TAG_LENGTH_BITS / 8; // 28 bytes

/**
 * Parses a 64-character hex string (32 bytes / 256 bits) into a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  if (cleanHex.length !== 64) {
    throw new Error('Invalid secret key: must be a 64-character hex string (32 bytes / 256 bits)');
  }
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error('Invalid secret key: contains non-hexadecimal characters');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Formats a byte array as a lowercase hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encodes a byte array into a URL-safe Base64 (base64url) string without padding.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 (base64url) string into a Uint8Array.
 */
export function base64UrlToBytes(str: string): Uint8Array {
  const trimmed = str.trim();
  if (!trimmed) {
    throw new Error('Invalid base64url string: empty input');
  }
  let base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Invalid base64url encoding');
  }
}

/**
 * Seals plaintext using AES-256-GCM with the specified 256-bit secret key (in hex) and AAD.
 * Returns a base64url-encoded string packing: [12-byte IV || ciphertext || 16-byte tag].
 */
export async function seal(
  plaintext: string,
  secretKeyHex: string,
  aad: string,
): Promise<string> {
  const keyBytes = hexToBytes(secretKeyHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  const aadBytes = encoder.encode(aad);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aadBytes,
      tagLength: TAG_LENGTH_BITS,
    },
    cryptoKey,
    plaintextBytes,
  );

  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  return bytesToBase64Url(combined);
}

/**
 * Unseals a base64url-encoded ciphertext using AES-256-GCM with the specified secret key and AAD.
 * Throws if the authentication tag fails (e.g. mismatched AAD, wrong key, tampered data).
 */
export async function unseal(
  ciphertext: string,
  secretKeyHex: string,
  aad: string,
): Promise<string> {
  const keyBytes = hexToBytes(secretKeyHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const combined = base64UrlToBytes(ciphertext);
  if (combined.byteLength < MIN_COMBINED_PAYLOAD_BYTES) {
    throw new Error('Invalid ciphertext length: payload is too short');
  }

  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertextAndTag = combined.slice(IV_LENGTH_BYTES);
  const aadBytes = new TextEncoder().encode(aad);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadBytes,
        tagLength: TAG_LENGTH_BITS,
      },
      cryptoKey,
      ciphertextAndTag,
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('Decryption failed: authentication tag mismatch or corrupted payload');
  }
}
