import { describe, expect, it } from 'vitest';
import {
  parsePackageFromBlob,
  parsePackageFromJson,
  parsePackageFromUint8Array,
} from '../StudyPackageParser';

describe('StudyPackageParser', () => {
  it('parses valid JSON string', () => {
    const raw = JSON.stringify({ format: 'lcpack', schemaVersion: 1 });
    const parsed = parsePackageFromJson(raw) as any;
    expect(parsed.format).toBe('lcpack');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('throws descriptive error on malformed JSON', () => {
    expect(() => parsePackageFromJson('{ invalid json')).toThrow('Failed to parse JSON');
  });

  it('parses package from Blob', async () => {
    const jsonString = JSON.stringify({ format: 'lcpack', title: 'From Blob' });
    const blob = new Blob([jsonString], { type: 'application/json' });
    const parsed = (await parsePackageFromBlob(blob)) as any;
    expect(parsed.format).toBe('lcpack');
    expect(parsed.title).toBe('From Blob');
  });

  it('parses package from Uint8Array', () => {
    const jsonString = JSON.stringify({ format: 'lcpack', title: 'From Uint8Array' });
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonString);
    const parsed = parsePackageFromUint8Array(bytes) as any;
    expect(parsed.format).toBe('lcpack');
    expect(parsed.title).toBe('From Uint8Array');
  });
});
