import { describe, expect, it } from 'vitest';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  hexToBytes,
  seal,
  unseal,
} from '../crypto';

describe('worker/src/core/crypto', () => {
  const validKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const alternativeKeyHex = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  describe('hex utilities', () => {
    it('converts 64-char hex to 32 bytes and back', () => {
      const bytes = hexToBytes(validKeyHex);
      expect(bytes.byteLength).toBe(32);
      expect(bytesToHex(bytes)).toBe(validKeyHex);
    });

    it('rejects hex with invalid length', () => {
      expect(() => hexToBytes('abcd')).toThrow('Invalid secret key');
      expect(() => hexToBytes(validKeyHex + '00')).toThrow('Invalid secret key');
    });

    it('rejects hex with non-hexadecimal characters', () => {
      const badHex = validKeyHex.slice(0, 62) + 'zz';
      expect(() => hexToBytes(badHex)).toThrow('Invalid secret key: contains non-hexadecimal characters');
    });
  });

  describe('base64url utilities', () => {
    it('round-trips binary data safely without padding or unsafe characters', () => {
      const data = new Uint8Array([255, 254, 253, 0, 1, 2, 63, 62]);
      const encoded = bytesToBase64Url(data);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
      const decoded = base64UrlToBytes(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(data));
    });

    it('rejects empty or corrupt base64url strings', () => {
      expect(() => base64UrlToBytes('')).toThrow('empty input');
    });
  });

  describe('seal and unseal (AES-256-GCM)', () => {
    it('successfully seals and unseals plaintext with matching AAD and key', async () => {
      const plaintext = '1//0gRefreshSecretTokenValueExample123456';
      const userSub = 'google-user-sub-1029384756';

      const sealed = await seal(plaintext, validKeyHex, userSub);
      expect(typeof sealed).toBe('string');
      expect(sealed.length).toBeGreaterThan(0);

      const unsealed = await unseal(sealed, validKeyHex, userSub);
      expect(unsealed).toBe(plaintext);
    });

    it('generates distinct ciphertexts across calls due to unique random IVs', async () => {
      const plaintext = 'token-to-encrypt';
      const userSub = 'google-user-sub-123';

      const sealed1 = await seal(plaintext, validKeyHex, userSub);
      const sealed2 = await seal(plaintext, validKeyHex, userSub);

      expect(sealed1).not.toBe(sealed2);
      expect(await unseal(sealed1, validKeyHex, userSub)).toBe(plaintext);
      expect(await unseal(sealed2, validKeyHex, userSub)).toBe(plaintext);
    });

    it('prevents account transplantation: rejects unseal when AAD (user sub) differs', async () => {
      const plaintext = 'confidential-refresh-token';
      const legitUserSub = 'user-alice-sub';
      const attackerUserSub = 'user-mallory-sub';

      const sealed = await seal(plaintext, validKeyHex, legitUserSub);

      await expect(unseal(sealed, validKeyHex, attackerUserSub)).rejects.toThrow(
        /Decryption failed: authentication tag mismatch/,
      );
    });

    it('rejects unseal when the secret key differs', async () => {
      const plaintext = 'confidential-token';
      const userSub = 'user-sub-123';

      const sealed = await seal(plaintext, validKeyHex, userSub);

      await expect(unseal(sealed, alternativeKeyHex, userSub)).rejects.toThrow(
        /Decryption failed: authentication tag mismatch/,
      );
    });

    it('rejects unseal when ciphertext payload is tampered', async () => {
      const plaintext = 'confidential-token';
      const userSub = 'user-sub-123';

      const sealed = await seal(plaintext, validKeyHex, userSub);
      const rawBytes = base64UrlToBytes(sealed);
      // Tamper one byte in the ciphertext body
      rawBytes[15] ^= 0xff;
      const tamperedSealed = bytesToBase64Url(rawBytes);

      await expect(unseal(tamperedSealed, validKeyHex, userSub)).rejects.toThrow(
        /Decryption failed: authentication tag mismatch/,
      );
    });

    it('rejects unseal when payload is too short (< 28 bytes)', async () => {
      const shortBytes = new Uint8Array(20);
      const shortEncoded = bytesToBase64Url(shortBytes);

      await expect(unseal(shortEncoded, validKeyHex, 'sub')).rejects.toThrow(
        /Invalid ciphertext length: payload is too short/,
      );
    });

    it('handles unicode and empty plaintext strings', async () => {
      const unicodeText = '🔑 Token with emoji & 日本語 & special characters !@#$%^&*()';
      const userSub = 'sub-unicode';

      const sealed = await seal(unicodeText, validKeyHex, userSub);
      const unsealed = await unseal(sealed, validKeyHex, userSub);
      expect(unsealed).toBe(unicodeText);

      const emptySealed = await seal('', validKeyHex, userSub);
      const emptyUnsealed = await unseal(emptySealed, validKeyHex, userSub);
      expect(emptyUnsealed).toBe('');
    });
  });
});
