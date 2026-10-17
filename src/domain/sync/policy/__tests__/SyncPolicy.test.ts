import { describe, it, expect } from 'vitest';
import {
  SYNC_POLICY,
  restoreOrder,
  assertPolicyMatchesSchema,
  isPrunable,
  syncedTables,
  tableForEntity,
  getTablesForCategory,
  toWire,
  defaultEncoding,
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
    expect(tableForEntity('document')).toBe('documentContents');
    expect(tableForEntity('highlight')).toBe('highlights');
    expect(tableForEntity('drawing')).toBe('drawings');
    expect(tableForEntity('reviewLog')).toBe('reviewLogs');
    expect(tableForEntity('unknownEntity')).toBeUndefined();
  });

  it('getTablesForCategory maps categories to their authoritative tables', () => {
    expect(getTablesForCategory('annotations')).toEqual(['highlights', 'drawings']);
    expect(getTablesForCategory('flashcards')).toEqual(['reviewLogs', 'flashcardReviews']);
    expect(getTablesForCategory('studyHistory')).toEqual(['quizSessions']);
    expect(getTablesForCategory('quizHistory')).toEqual(['quizSessions']);
    expect(getTablesForCategory('customMaterials')).toEqual([
      'materials',
      'questions',
      'quizzes',
      'documentContents',
    ]);
  });

  describe('toWire() & defaultEncoding()', () => {
    it('toWire strips internal sync metadata keys and excluded fields', () => {
      const row = {
        id: 'row-1',
        name: 'test',
        _hlc: 'hlc-1',
        _rev: 'rev-1',
        _anc: ['anc-1'],
        blobCache: 'cache',
      };
      const wire = toWire(row, ['blobCache']);
      expect(wire).toEqual({ id: 'row-1', name: 'test' });
    });

    it('defaultEncoding encodes appendOnly tables with operation UPSERT', () => {
      const row = { id: 'rev-1', cardKey: 'q:1', at: 123456 };
      const encoded = defaultEncoding(row, SYNC_POLICY.reviewLogs);
      expect(encoded).toEqual({
        entity: 'reviewLog',
        value: { id: 'rev-1', cardKey: 'q:1', at: 123456 },
        operation: 'UPSERT',
      });
    });

    it('defaultEncoding encodes active LWW rows as UPSERT and soft-deleted rows as DELETE', () => {
      const activeRow = { id: 'hl-1', text: 'note', createdAt: '2026-10-10' };
      const activeEncoded = defaultEncoding(activeRow, SYNC_POLICY.highlights);
      expect(activeEncoded).toEqual({
        entity: 'highlight',
        value: { id: 'hl-1', text: 'note', createdAt: '2026-10-10' },
        operation: 'UPSERT',
      });

      const deletedRow = { id: 'hl-1', text: 'note', createdAt: '2026-10-10', deletedAt: '2026-10-12' };
      const deletedEncoded = defaultEncoding(deletedRow, SYNC_POLICY.highlights);
      expect(deletedEncoded).toEqual({
        entity: 'highlight',
        value: { id: 'hl-1', text: 'note', createdAt: '2026-10-10', deletedAt: '2026-10-12' },
        operation: 'DELETE',
      });
    });
  });

  describe('SYNC_POLICY table encoders', () => {
    it('materials.encode emits pointer for unmodified Explore clones', () => {
      const encoder = SYNC_POLICY.materials.encode!;
      expect(encoder).toBeDefined();

      const pointerRow = {
        id: 'mat-1',
        originShareId: 'share-abc',
        title: 'Quantum Computing',
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-10T10:00:00.000Z',
      };
      expect(encoder(pointerRow)).toEqual({
        entity: 'pointer',
        value: {
          originShareId: 'share-abc',
          title: 'Quantum Computing',
          publishedAt: '2026-10-10T10:00:00.000Z',
          schemaVersion: 1,
        },
        operation: 'UPSERT',
      });
    });

    it('materials.encode emits material for custom or user-modified materials', () => {
      const encoder = SYNC_POLICY.materials.encode!;

      const customRow = {
        id: 'mat-custom',
        title: 'My Custom Material',
        description: 'Desc',
        tags: ['bio'],
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-10T10:00:00.000Z',
      };
      expect(encoder(customRow)).toEqual({
        entity: 'material',
        value: {
          id: 'mat-custom',
          title: 'My Custom Material',
          description: 'Desc',
          tags: ['bio'],
          createdAt: '2026-10-10T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
          deletedAt: undefined,
        },
        operation: 'UPSERT',
      });

      const modifiedCloneRow = {
        id: 'mat-clone',
        originShareId: 'share-abc',
        title: 'Modified Quantum',
        description: 'Updated',
        tags: [],
        createdAt: '2026-10-10T10:00:00.000Z',
        updatedAt: '2026-10-12T12:00:00.000Z',
      };
      expect(encoder(modifiedCloneRow)).toEqual({
        entity: 'material',
        value: {
          id: 'mat-clone',
          title: 'Modified Quantum',
          description: 'Updated',
          tags: [],
          createdAt: '2026-10-10T10:00:00.000Z',
          updatedAt: '2026-10-12T12:00:00.000Z',
          deletedAt: undefined,
        },
        operation: 'UPSERT',
      });
    });

    it('documentContents.encode skips unmodified template at FLOOR_ISO and encodes modified or deleted records', () => {
      const encoder = SYNC_POLICY.documentContents.encode!;
      expect(encoder).toBeDefined();

      const templateRow = {
        documentId: 'doc-template',
        title: 'Template',
        content: '# Content',
        updatedAt: '1970-01-01T00:00:00.000Z',
        version: 1,
      };
      expect(encoder(templateRow)).toBeNull();

      const modifiedRow = {
        documentId: 'doc-mod',
        title: 'User Edited',
        content: '# New Content',
        updatedAt: '2026-10-15T12:00:00.000Z',
        version: 3,
      };
      expect(encoder(modifiedRow)).toEqual({
        entity: 'document',
        value: {
          documentId: 'doc-mod',
          title: 'User Edited',
          content: '# New Content',
          updatedAt: '2026-10-15T12:00:00.000Z',
          version: 3,
        },
        operation: 'UPSERT',
        baseVersion: 3,
      });

      const deletedTemplateRow = {
        documentId: 'doc-del',
        title: 'Template Deleted',
        content: '# Content',
        updatedAt: '1970-01-01T00:00:00.000Z',
        deletedAt: '2026-10-16T12:00:00.000Z',
        version: 1,
      };
      expect(encoder(deletedTemplateRow)).toEqual({
        entity: 'document',
        value: {
          documentId: 'doc-del',
          title: 'Template Deleted',
          content: '# Content',
          updatedAt: '1970-01-01T00:00:00.000Z',
          version: 1,
        },
        operation: 'DELETE',
        baseVersion: 1,
      });
    });
  });
});
