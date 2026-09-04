import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../LunaClairDatabase';
import { DatabaseMigrator } from '../DatabaseMigrator';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { HighlightItem, DrawingPath } from '../../../../domain/reader/models/annotation.types';

describe('DatabaseMigrator', () => {
  let db: LunaClairDatabase;
  let migrator: DatabaseMigrator;

  const V1_KEY = 'lunaclair.migration.v1.complete';
  const V2_KEY = 'lunaclair.migration.v2.complete';
  const V3_KEY = 'lunaclair.migration.v3.complete';

  beforeEach(async () => {
    localStorage.clear();
    db = new LunaClairDatabase(`test-migrator-${Math.random().toString(36).slice(2)}`);
    await db.open();
    migrator = new DatabaseMigrator(db);
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
    db.close();
  });

  it('runs cleanly when localStorage has no legacy data', async () => {
    await migrator.migrateIfNeeded();

    expect(await db.materials.count()).toBe(0);
    expect(await db.highlights.count()).toBe(0);
    expect(await db.drawings.count()).toBe(0);

    // Migration completion flags are set
    expect(localStorage.getItem(V1_KEY)).not.toBeNull();
    expect(localStorage.getItem(V2_KEY)).not.toBeNull();
    expect(localStorage.getItem(V3_KEY)).not.toBeNull();

    // Final metadata recorded databaseVersion 3
    const versionRecord = await db.metadata.get('databaseVersion');
    expect(versionRecord?.value).toBe(3);
  });

  it('migrates legacy materials, highlights, and drawings from localStorage to IndexedDB', async () => {
    const legacyMaterial: StudyMaterial = {
      id: 'legacy-mat-1',
      title: 'Legacy Material',
      documentId: 'doc-legacy',
      order: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const legacyHighlight: HighlightItem = {
      id: 'h-1',
      start: 0,
      end: 23,
      color: 'yellow',
      text: 'Highlighted anatomy text',
    };
    const legacyDrawing: DrawingPath = {
      id: 'd-1',
      color: '#ff0000',
      thickness: 2,
      points: [{ x: 10, y: 20 }],
    };

    localStorage.setItem(STORAGE_KEYS.library.materials, JSON.stringify([legacyMaterial]));
    localStorage.setItem(STORAGE_KEYS.reader.highlights, JSON.stringify([legacyHighlight]));
    localStorage.setItem(STORAGE_KEYS.reader.drawings, JSON.stringify([legacyDrawing]));

    await migrator.migrateIfNeeded();

    // Verify materials migrated
    const materials = await db.materials.toArray();
    expect(materials).toHaveLength(1);
    expect(materials[0].id).toBe('legacy-mat-1');
    expect(materials[0].title).toBe('Legacy Material');

    // Verify highlights migrated with documentId
    const highlights = await db.highlights.toArray();
    expect(highlights).toHaveLength(1);
    expect(highlights[0].id).toBe('h-1');
    expect(highlights[0].documentId).toBe('anatomy-physiology');

    // Verify drawings migrated with documentId
    const drawings = await db.drawings.toArray();
    expect(drawings).toHaveLength(1);
    expect(drawings[0].id).toBe('d-1');
    expect(drawings[0].documentId).toBe('anatomy-physiology');
  });

  it('is idempotent: second execution does not duplicate records or overwrite state', async () => {
    const legacyMaterial: StudyMaterial = {
      id: 'idempotent-mat',
      title: 'Idempotent Title',
      documentId: 'doc-idem',
      order: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEYS.library.materials, JSON.stringify([legacyMaterial]));

    // First migration
    await migrator.migrateIfNeeded();
    expect(await db.materials.count()).toBe(1);

    // Modify the DB record directly
    await db.materials.update('idempotent-mat', { title: 'User Modified Title' });

    // Second migration
    await migrator.migrateIfNeeded();

    // Record is NOT duplicated or overwritten
    expect(await db.materials.count()).toBe(1);
    const mat = await db.materials.get('idempotent-mat');
    expect(mat?.title).toBe('User Modified Title');
  });

  it('skips migration when completion flags are already set in localStorage', async () => {
    localStorage.setItem(V1_KEY, '2026-01-01T00:00:00.000Z');
    localStorage.setItem(V2_KEY, '2026-01-01T00:00:00.000Z');
    localStorage.setItem(V3_KEY, '2026-01-01T00:00:00.000Z');

    const legacyMaterial: StudyMaterial = {
      id: 'should-skip',
      title: 'Should Skip',
      documentId: 'doc-skip',
      order: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEYS.library.materials, JSON.stringify([legacyMaterial]));

    await migrator.migrateIfNeeded();

    // Because flags were present, V1 did not run
    expect(await db.materials.count()).toBe(0);
  });

  it('normalizes un-normalized question tags in v3 migration pass', async () => {
    // Seed existing questions in DB before v3 migration runs
    const q: Question = {
      id: 'q-legacy-tags',
      materialId: 'mat-1',
      type: 'multiple_choice',
      prompt: 'Tag test prompt',
      payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
      difficulty: 'medium',
      points: 10,
      status: 'published',
      tags: ['#Cardio', 'cardio', 'heart', '#HEART'],
      version: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    await db.questions.put(q);

    // Ensure V1 and V2 are marked complete so only V3 runs
    localStorage.setItem(V1_KEY, 'done');
    localStorage.setItem(V2_KEY, 'done');

    await migrator.migrateIfNeeded();

    const migratedQ = await db.questions.get('q-legacy-tags');
    // Normalization rule: strip '#', dedup case-insensitively, preserve first-seen casing
    expect(migratedQ?.tags).toEqual(['Cardio', 'heart']);
    expect(localStorage.getItem(V3_KEY)).not.toBeNull();
  });
});
