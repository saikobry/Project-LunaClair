import { describe, it, expect } from 'vitest';
import {
  evaluateDocumentConcurrency,
  nextEntityVersion,
  compareLwwTimestamps,
} from '../syncVersioning';

describe('Sync Versioning & Concurrency Resolution', () => {
  describe('evaluateDocumentConcurrency', () => {
    it('returns match when base version equals server version', () => {
      expect(evaluateDocumentConcurrency(1, 1)).toBe('match');
      expect(evaluateDocumentConcurrency(5, 5)).toBe('match');
      expect(evaluateDocumentConcurrency(0, 0)).toBe('match');
    });

    it('returns conflict when base version diverges from server version', () => {
      expect(evaluateDocumentConcurrency(1, 2)).toBe('conflict');
      expect(evaluateDocumentConcurrency(0, 1)).toBe('conflict');
      expect(evaluateDocumentConcurrency(3, 2)).toBe('conflict');
    });
  });

  describe('nextEntityVersion', () => {
    it('returns 1 for undefined or 0 current version', () => {
      expect(nextEntityVersion(undefined)).toBe(1);
      expect(nextEntityVersion(0)).toBe(1);
    });

    it('increments version monotonically', () => {
      expect(nextEntityVersion(1)).toBe(2);
      expect(nextEntityVersion(2)).toBe(3);
      expect(nextEntityVersion(99)).toBe(100);
    });
  });

  describe('compareLwwTimestamps', () => {
    it('returns local_wins when local timestamp is more recent', () => {
      const local = '2026-08-27T12:00:00.000Z';
      const remote = '2026-08-27T11:00:00.000Z';
      expect(compareLwwTimestamps(local, remote)).toBe('local_wins');
    });

    it('returns remote_wins when remote timestamp is more recent', () => {
      const local = '2026-08-27T11:00:00.000Z';
      const remote = '2026-08-27T12:00:00.000Z';
      expect(compareLwwTimestamps(local, remote)).toBe('remote_wins');
    });

    it('returns equal when timestamps are identical', () => {
      const ts = '2026-08-27T12:00:00.000Z';
      expect(compareLwwTimestamps(ts, ts)).toBe('equal');
    });

    it('falls back gracefully on non-standard timestamp strings', () => {
      expect(compareLwwTimestamps('2026-08-27B', '2026-08-27A')).toBe('local_wins');
      expect(compareLwwTimestamps('2026-08-27A', '2026-08-27B')).toBe('remote_wins');
      expect(compareLwwTimestamps('abc', 'abc')).toBe('equal');
    });
  });
});
