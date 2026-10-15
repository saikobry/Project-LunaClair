import { describe, it, expect } from 'vitest';
import {
  HybridLogicalClock,
  createHlc,
  compareHlc,
  parseHlc,
  isValidHlc,
} from '../hlc';

describe('Domain: Hybrid Logical Clock (HLC)', () => {
  describe('createHlc and format', () => {
    it('creates an HLC instance and generates correctly formatted timestamps', () => {
      const fixedTime = new Date('2026-10-15T12:00:00.000Z');
      const hlc = createHlc('device-alpha', () => fixedTime);

      const timestamp = hlc.now();
      expect(hlc).toBeInstanceOf(HybridLogicalClock);
      expect(timestamp).toBe('2026-10-15T12:00:00.000Z_0000_device-alpha');
      expect(isValidHlc(timestamp)).toBe(true);

      const parsed = parseHlc(timestamp);
      expect(parsed.physical).toBe('2026-10-15T12:00:00.000Z');
      expect(parsed.counter).toBe(0);
      expect(parsed.deviceId).toBe('device-alpha');
    });

    it('rejects empty or non-string deviceId', () => {
      expect(() => createHlc('')).toThrow('HybridLogicalClock deviceId must be a non-empty string');
      expect(() => createHlc(null as unknown as string)).toThrow();
    });
  });

  describe('Local event monotonicity and counter advance', () => {
    it('increments logical counter when physical clock remains in the same millisecond', () => {
      const fixedTime = new Date('2026-10-15T12:00:00.000Z');
      const hlc = createHlc('dev-1', () => fixedTime);

      const t1 = hlc.now();
      const t2 = hlc.now();
      const t3 = hlc.now();

      expect(t1).toBe('2026-10-15T12:00:00.000Z_0000_dev-1');
      expect(t2).toBe('2026-10-15T12:00:00.000Z_0001_dev-1');
      expect(t3).toBe('2026-10-15T12:00:00.000Z_0002_dev-1');

      expect(compareHlc(t1, t2)).toBeLessThan(0);
      expect(compareHlc(t2, t3)).toBeLessThan(0);
    });

    it('resets logical counter to 0 when physical clock advances', () => {
      let currentMillis = new Date('2026-10-15T12:00:00.000Z').getTime();
      const clockSource = () => new Date(currentMillis);
      const hlc = createHlc('dev-1', clockSource);

      const t1 = hlc.now();
      const t2 = hlc.now();
      expect(t1).toBe('2026-10-15T12:00:00.000Z_0000_dev-1');
      expect(t2).toBe('2026-10-15T12:00:00.000Z_0001_dev-1');

      // Advance clock by 100 milliseconds
      currentMillis += 100;

      const t3 = hlc.now();
      expect(t3).toBe('2026-10-15T12:00:00.100Z_0000_dev-1');
      expect(compareHlc(t2, t3)).toBeLessThan(0);
    });

    it('preserves monotonicity during backward physical clock skew', () => {
      let currentMillis = new Date('2026-10-15T12:00:05.000Z').getTime();
      const clockSource = () => new Date(currentMillis);
      const hlc = createHlc('dev-1', clockSource);

      const t1 = hlc.now();
      expect(t1).toBe('2026-10-15T12:00:05.000Z_0000_dev-1');

      // Clock skews backwards by 2 seconds
      currentMillis -= 2000;

      const t2 = hlc.now();
      // Must retain latest physical timestamp and increment counter
      expect(t2).toBe('2026-10-15T12:00:05.000Z_0001_dev-1');
      expect(compareHlc(t1, t2)).toBeLessThan(0);
    });
  });

  describe('Receiving remote HLC timestamps', () => {
    it('advances clock beyond remote future timestamp', () => {
      const localTime = new Date('2026-10-15T12:00:00.000Z');
      const hlc = createHlc('dev-local', () => localTime);

      const remoteHlc = '2026-10-15T12:05:00.000Z_0004_dev-remote';
      const received = hlc.receive(remoteHlc);

      expect(received).toBe('2026-10-15T12:05:00.000Z_0005_dev-local');
      expect(compareHlc(remoteHlc, received)).toBeLessThan(0);

      // Next local event continues monotonically
      const nextLocal = hlc.now();
      expect(nextLocal).toBe('2026-10-15T12:05:00.000Z_0006_dev-local');
      expect(compareHlc(received, nextLocal)).toBeLessThan(0);
    });

    it('advances counter when remote timestamp is at same physical time with higher counter', () => {
      const fixedTime = new Date('2026-10-15T12:00:00.000Z');
      const hlc = createHlc('dev-local', () => fixedTime);

      hlc.now(); // 12:00:00.000Z_0000_dev-local
      const remoteHlc = '2026-10-15T12:00:00.000Z_000a_dev-remote';

      const received = hlc.receive(remoteHlc);
      expect(received).toBe('2026-10-15T12:00:00.000Z_000b_dev-local');
      expect(compareHlc(remoteHlc, received)).toBeLessThan(0);
    });

    it('maintains local physical time when remote timestamp is in the past', () => {
      const localTime = new Date('2026-10-15T12:10:00.000Z');
      const hlc = createHlc('dev-local', () => localTime);

      hlc.now(); // 12:10:00.000Z_0000_dev-local
      const remotePast = '2026-10-15T12:00:00.000Z_0003_dev-remote';

      const received = hlc.receive(remotePast);
      expect(received).toBe('2026-10-15T12:10:00.000Z_0001_dev-local');
      expect(compareHlc(remotePast, received)).toBeLessThan(0);
    });

    it('resets counter to 0 when local physical clock catches up beyond remote timestamp', () => {
      let currentMillis = new Date('2026-10-15T12:00:00.000Z').getTime();
      const hlc = createHlc('dev-local', () => new Date(currentMillis));

      const remoteFuture = '2026-10-15T12:01:00.000Z_0002_dev-remote';
      hlc.receive(remoteFuture); // 12:01:00.000Z_0003_dev-local

      // Advance local physical clock past the remote time
      currentMillis = new Date('2026-10-15T12:05:00.000Z').getTime();

      const next = hlc.now();
      expect(next).toBe('2026-10-15T12:05:00.000Z_0000_dev-local');
    });
  });

  describe('compareHlc total ordering', () => {
    it('compares physical timestamp first', () => {
      const earlier = '2026-10-15T10:00:00.000Z_0010_dev-z';
      const later = '2026-10-15T11:00:00.000Z_0000_dev-a';

      expect(compareHlc(earlier, later)).toBeLessThan(0);
      expect(compareHlc(later, earlier)).toBeGreaterThan(0);
    });

    it('compares logical counter when physical timestamp is identical', () => {
      const c1 = '2026-10-15T12:00:00.000Z_0001_dev-z';
      const c2 = '2026-10-15T12:00:00.000Z_0002_dev-a';

      expect(compareHlc(c1, c2)).toBeLessThan(0);
      expect(compareHlc(c2, c1)).toBeGreaterThan(0);
    });

    it('tiebreaks using deviceId when physical timestamp and counter are identical', () => {
      const dA = '2026-10-15T12:00:00.000Z_0001_device-a';
      const dB = '2026-10-15T12:00:00.000Z_0001_device-b';

      expect(compareHlc(dA, dB)).toBeLessThan(0);
      expect(compareHlc(dB, dA)).toBeGreaterThan(0);
    });

    it('returns 0 for identical HLC strings', () => {
      const hlc = '2026-10-15T12:00:00.000Z_0005_device-xyz';
      expect(compareHlc(hlc, hlc)).toBe(0);
    });

    it('sorts an array of HLC timestamps deterministically', () => {
      const unordered = [
        '2026-10-15T12:00:00.000Z_0005_device-b',
        '2026-10-15T11:00:00.000Z_0001_device-a',
        '2026-10-15T12:00:00.000Z_0005_device-a',
        '2026-10-15T12:00:00.000Z_0002_device-c',
      ];

      const sorted = [...unordered].sort(compareHlc);

      expect(sorted).toEqual([
        '2026-10-15T11:00:00.000Z_0001_device-a',
        '2026-10-15T12:00:00.000Z_0002_device-c',
        '2026-10-15T12:00:00.000Z_0005_device-a',
        '2026-10-15T12:00:00.000Z_0005_device-b',
      ]);
    });
  });

  describe('parseHlc and isValidHlc validation', () => {
    it('validates well-formed HLC strings', () => {
      expect(isValidHlc('2026-10-15T12:00:00.000Z_0000_device-1')).toBe(true);
      expect(isValidHlc('2026-10-15T12:00:00.000Z_ffff_device-1_sub')).toBe(true);
    });

    it('rejects invalid or malformed HLC strings', () => {
      expect(isValidHlc('invalid-string')).toBe(false);
      expect(isValidHlc('2026-10-15_nothex_dev1')).toBe(false);
      expect(isValidHlc('2026-10-15T12:00:00.000Z_001_dev1')).toBe(false); // only 3 hex digits
    });

    it('throws descriptive error when parseHlc fails', () => {
      expect(() => parseHlc('malformed')).toThrow('Invalid HLC format: "malformed"');
    });
  });
});
