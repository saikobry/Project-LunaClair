import { describe, it, expect } from 'vitest';
import {
  SYNC_POLICY,
  restoreOrder,
  assertPolicyMatchesSchema,
  isPrunable,
  syncedTables,
  tableForEntity,
  type TablePolicy,
} from '../SyncPolicy';

describe('SyncPolicy Registry & Declarative Contracts', () => {
  it('policy matches canonical schema table names', () => {
    const tableNames = Object.keys(SYNC_POLICY);
    expect(() => assertPolicyMatchesSchema(tableNames)).not.toThrow();
  });

  it('detects schema drift when an unexpected table exists in real schema', () => {
    const tableNamesWithExtra = [...Object.keys(SYNC_POLICY), 'surprise'];
    expect(() => assertPolicyMatchesSchema(tableNamesWithExtra)).toThrow(/missing: \[surprise\]/);
  });

  it('detects schema drift when a declared table is missing from real schema', () => {
    const tableNamesMissingOne = Object.keys(SYNC_POLICY).filter((name) => name !== 'materials');
    expect(() => assertPolicyMatchesSchema(tableNamesMissingOne)).toThrow(/phantom: \[materials\]/);
  });

  it('restoreOrder orders parent tables before dependent children', () => {
    const order = restoreOrder();
    const expectations: Array<[string, string]> = [
      ['materials', 'questions'],
      ['materials', 'documentContents'],
      ['documentContents', 'highlights'],
      ['documentContents', 'drawings'],
      ['questions', 'quizzes'],
      ['quizzes', 'quizSessions'],
    ];

    for (const [parent, child] of expectations) {
      const parentIdx = order.indexOf(parent as any);
      const childIdx = order.indexOf(child as any);
      expect(parentIdx).toBeGreaterThanOrEqual(0);
      expect(childIdx).toBeGreaterThanOrEqual(0);
      expect(parentIdx).toBeLessThan(childIdx);
    }
  });

  it('restoreOrder throws an error if a dependency cycle is introduced', () => {
    const cyclicPolicy: Record<string, TablePolicy> = {
      tableA: {
        kind: 'authoritative',
        entity: 'a',
        mergeStrategy: 'lww',
        category: 'customMaterials',
        dependencies: ['tableB' as any],
        schemaVersion: 1,
        upcasters: {},
      },
      tableB: {
        kind: 'authoritative',
        entity: 'b',
        mergeStrategy: 'lww',
        category: 'customMaterials',
        dependencies: ['tableA' as any],
        schemaVersion: 1,
        upcasters: {},
      },
    };

    expect(() => restoreOrder(cyclicPolicy)).toThrow('SYNC_POLICY dependency cycle');
  });

  it('isPrunable allows pruning only for derived and prunable local-only tables', () => {
    expect(isPrunable('localAssets')).toBe(true);
    expect(isPrunable('assetCache')).toBe(true);
    expect(isPrunable('flashcardReviews')).toBe(true);

    expect(isPrunable('outbox')).toBe(false);
    expect(isPrunable('tombstones')).toBe(false);
    expect(isPrunable('conflictDrafts')).toBe(false);
    expect(isPrunable('heldOps')).toBe(false);
    expect(isPrunable('pendingHydrations')).toBe(false);
    expect(isPrunable('syncCursor')).toBe(false);

    expect(isPrunable('materials')).toBe(false);
    expect(isPrunable('questions')).toBe(false);
    expect(isPrunable('quizzes')).toBe(false);
    expect(isPrunable('quizSessions')).toBe(false);
    expect(isPrunable('documentContents')).toBe(false);
    expect(isPrunable('highlights')).toBe(false);
    expect(isPrunable('drawings')).toBe(false);
    expect(isPrunable('reviewLogs')).toBe(false);
  });

  it('syncedTables returns all authoritative tables with proper metadata', () => {
    const synced = syncedTables();
    expect(synced.length).toBe(8);
    for (const [, config] of synced) {
      expect(config.kind).toBe('authoritative');
      expect(typeof config.entity).toBe('string');
      expect(typeof config.schemaVersion).toBe('number');
    }
  });

  it('tableForEntity maps entity names to canonical table names', () => {
    expect(tableForEntity('material')).toBe('materials');
    expect(tableForEntity('question')).toBe('questions');
    expect(tableForEntity('quiz')).toBe('quizzes');
    expect(tableForEntity('quizSession')).toBe('quizSessions');
    expect(tableForEntity('quizAttempt')).toBe('quizSessions');
    expect(tableForEntity('documentContent')).toBe('documentContents');
    expect(tableForEntity('highlight')).toBe('highlights');
    expect(tableForEntity('drawing')).toBe('drawings');
    expect(tableForEntity('reviewLog')).toBe('reviewLogs');
    expect(tableForEntity('unknownEntity')).toBeUndefined();
  });
});
