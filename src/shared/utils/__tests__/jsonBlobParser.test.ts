import { describe, expect, it } from 'vitest';
import {
  parseJsonFromBlob,
  parseJsonFromString,
  parseJsonFromBytes,
} from '../jsonBlobParser';

describe('jsonBlobParser', () => {
  describe('parseJsonFromString', () => {
    it('parses valid JSON string', () => {
      const raw = JSON.stringify({ format: 'lcpack', schemaVersion: 1, items: [1, 2, 3] });
      const parsed = parseJsonFromString(raw) as { format: string; schemaVersion: number; items: number[] };
      expect(parsed.format).toBe('lcpack');
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.items).toEqual([1, 2, 3]);
    });

    it('throws descriptive error on malformed JSON', () => {
      expect(() => parseJsonFromString('{ invalid json')).toThrow('Failed to parse JSON');
    });
  });

  describe('parseJsonFromBlob', () => {
    it('parses JSON payload from Blob', async () => {
      const payload = { format: 'lcpack', title: 'From Blob', count: 42 };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const parsed = (await parseJsonFromBlob(blob)) as typeof payload;
      expect(parsed.format).toBe('lcpack');
      expect(parsed.title).toBe('From Blob');
      expect(parsed.count).toBe(42);
    });

    it('throws descriptive error on malformed JSON in Blob', async () => {
      const blob = new Blob(['{ not json'], { type: 'application/json' });
      await expect(parseJsonFromBlob(blob)).rejects.toThrow('Failed to parse JSON');
    });
  });

  describe('parseJsonFromBytes', () => {
    it('parses JSON payload from Uint8Array', () => {
      const payload = { format: 'lcpack', title: 'From Uint8Array', active: true };
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const parsed = parseJsonFromBytes(bytes) as typeof payload;
      expect(parsed.format).toBe('lcpack');
      expect(parsed.title).toBe('From Uint8Array');
      expect(parsed.active).toBe(true);
    });

    it('throws descriptive error on malformed JSON in Uint8Array', () => {
      const bytes = new TextEncoder().encode('not-json');
      expect(() => parseJsonFromBytes(bytes)).toThrow('Failed to parse JSON');
    });
  });
});
