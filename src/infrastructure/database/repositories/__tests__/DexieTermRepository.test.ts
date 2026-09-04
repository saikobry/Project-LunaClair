import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { dexieTermRepository, DexieTermRepository } from '../DexieTermRepository';
import type { Term } from '../../../../domain/library/models/Term';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { SubjectTerm } from '../../../../domain/library/models/SubjectTerm';

describe('DexieTermRepository', () => {
  let repo: DexieTermRepository;

  beforeEach(async () => {
    await Promise.all([
      db.terms.clear(),
      db.subjectTerms.clear(),
      db.materials.clear(),
    ]);
    repo = dexieTermRepository;
  });

  afterEach(async () => {
    await Promise.all([
      db.terms.clear(),
      db.subjectTerms.clear(),
      db.materials.clear(),
    ]);
  });

  it('performs CRUD operations on terms', async () => {
    // Create
    const created = await repo.createTerm({ title: 'Midterm 2026' });
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Midterm 2026');

    // Read by ID
    const found = await repo.getTermById(created.id);
    expect(found).toEqual(created);

    // Read all
    const all = await repo.getTerms();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);

    // Update
    const updated = await repo.updateTerm(created.id, { title: 'Midterm Spring 2026' });
    expect(updated.title).toBe('Midterm Spring 2026');

    const refetched = await repo.getTermById(created.id);
    expect(refetched?.title).toBe('Midterm Spring 2026');
  });

  it('throws error when updating non-existent term', async () => {
    await expect(
      repo.updateTerm('unknown-term', { title: 'Should Fail' }),
    ).rejects.toThrow('Term not found: unknown-term');
  });

  it('upserts terms idempotently in bulk', async () => {
    const terms: Term[] = [
      { id: 'prelim', title: 'Prelim', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'midterm', title: 'Midterm', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'finals', title: 'Finals', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];

    // First upsert
    await repo.upsertTerms(terms);
    expect(await db.terms.count()).toBe(3);

    // Second upsert with an updated title
    const updatedTerms: Term[] = [
      ...terms.slice(0, 2),
      { ...terms[2], title: 'Final Examinations' },
    ];
    await repo.upsertTerms(updatedTerms);

    // Total count remains 3 (idempotent, no duplicates)
    expect(await db.terms.count()).toBe(3);
    const finals = await repo.getTermById('finals');
    expect(finals?.title).toBe('Final Examinations');
  });

  it('cascades deletion by removing subjectTerms and clearing termId on materials', async () => {
    const term = await repo.createTerm({ title: 'Special Term' });
    const termId = term.id;

    // Seed linked subjectTerms
    const link1: SubjectTerm = { subjectId: 'subj-1', termId, order: 1 };
    const link2: SubjectTerm = { subjectId: 'subj-2', termId, order: 1 };
    const otherLink: SubjectTerm = { subjectId: 'subj-1', termId: 'other-term', order: 2 };
    await db.subjectTerms.bulkPut([link1, link2, otherLink]);

    // Seed associated materials
    const now = new Date().toISOString();
    const mat1: StudyMaterial = {
      id: 'mat-1',
      title: 'Material 1',
      documentId: 'doc-1',
      subjectId: 'subj-1',
      termId,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const matOther: StudyMaterial = {
      id: 'mat-2',
      title: 'Material 2',
      documentId: 'doc-2',
      subjectId: 'subj-1',
      termId: 'other-term',
      order: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.materials.bulkPut([mat1, matOther]);

    // Delete term
    await repo.deleteTerm(termId);

    // 1. Term itself is deleted
    expect(await repo.getTermById(termId)).toBeNull();

    // 2. Cascade: SubjectTerms referencing this term are deleted, other kept
    const remainingForTerm = await db.subjectTerms.where('termId').equals(termId).toArray();
    expect(remainingForTerm).toHaveLength(0);
    const otherTermLinks = await db.subjectTerms.where('termId').equals('other-term').toArray();
    expect(otherTermLinks).toHaveLength(1);

    // 3. Cascade: Material termId cleared to undefined, subjectId preserved
    const updatedMat1 = await db.materials.get('mat-1');
    expect(updatedMat1?.termId).toBeUndefined();
    expect(updatedMat1?.subjectId).toBe('subj-1');

    // Untouched material remains intact
    const updatedMat2 = await db.materials.get('mat-2');
    expect(updatedMat2?.termId).toBe('other-term');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(repo.getTerms(controller.signal)).rejects.toThrow();
    await expect(repo.getTermById('term-1', controller.signal)).rejects.toThrow();
  });
});
