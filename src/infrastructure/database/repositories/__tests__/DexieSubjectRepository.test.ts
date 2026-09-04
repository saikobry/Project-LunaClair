import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../LunaClairDatabase';
import { dexieSubjectRepository, DexieSubjectRepository } from '../DexieSubjectRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { SubjectTerm } from '../../../../domain/library/models/SubjectTerm';

describe('DexieSubjectRepository', () => {
  let repo: DexieSubjectRepository;

  beforeEach(async () => {
    await Promise.all([
      db.subjects.clear(),
      db.subjectTerms.clear(),
      db.materials.clear(),
    ]);
    repo = dexieSubjectRepository;
  });

  afterEach(async () => {
    await Promise.all([
      db.subjects.clear(),
      db.subjectTerms.clear(),
      db.materials.clear(),
    ]);
  });

  it('performs CRUD operations on subjects', async () => {
    // Create
    const created = await repo.createSubject({
      title: 'Neuroscience',
      description: 'Study of nervous system',
    });
    expect(created.id).toBeDefined();
    expect(created.title).toBe('Neuroscience');

    // Read by id
    const found = await repo.getSubjectById(created.id);
    expect(found).toEqual(created);

    // Read all
    const all = await repo.getSubjects();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);

    // Update
    const updated = await repo.updateSubject(created.id, {
      title: 'Advanced Neuroscience',
      description: 'Updated description',
    });
    expect(updated.title).toBe('Advanced Neuroscience');
    expect(updated.description).toBe('Updated description');

    const refetched = await repo.getSubjectById(created.id);
    expect(refetched?.title).toBe('Advanced Neuroscience');
  });

  it('throws error when updating non-existent subject', async () => {
    await expect(
      repo.updateSubject('non-existent-id', { title: 'New Title' }),
    ).rejects.toThrow('Subject not found: non-existent-id');
  });

  it('reorders subjects by updating order sequentially', async () => {
    const s1 = await repo.createSubject({ title: 'Subj 1' });
    const s2 = await repo.createSubject({ title: 'Subj 2' });
    const s3 = await repo.createSubject({ title: 'Subj 3' });

    // Reverse order
    await repo.reorderSubjects([s3.id, s1.id, s2.id]);

    const s3After = await repo.getSubjectById(s3.id);
    const s1After = await repo.getSubjectById(s1.id);
    const s2After = await repo.getSubjectById(s2.id);

    expect(s3After?.order).toBe(0);
    expect(s1After?.order).toBe(1);
    expect(s2After?.order).toBe(2);
  });

  it('cascades deletion by removing subjectTerms and clearing subjectId/termId on materials', async () => {
    const subject = await repo.createSubject({ title: 'Biochemistry' });
    const subjectId = subject.id;

    // Seed linked subjectTerms
    const link1: SubjectTerm = { subjectId, termId: 'term-prelim', order: 1 };
    const link2: SubjectTerm = { subjectId, termId: 'term-finals', order: 2 };
    const otherLink: SubjectTerm = { subjectId: 'other-subj', termId: 'term-prelim', order: 1 };
    await db.subjectTerms.bulkPut([link1, link2, otherLink]);

    // Seed associated materials
    const now = new Date().toISOString();
    const mat1: StudyMaterial = {
      id: 'mat-1',
      title: 'Proteins',
      documentId: 'doc-1',
      subjectId,
      termId: 'term-prelim',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const mat2: StudyMaterial = {
      id: 'mat-2',
      title: 'Enzymes',
      documentId: 'doc-2',
      subjectId,
      termId: 'term-finals',
      order: 1,
      createdAt: now,
      updatedAt: now,
    };
    const unrelatedMat: StudyMaterial = {
      id: 'mat-unrelated',
      title: 'Unrelated Material',
      documentId: 'doc-3',
      subjectId: 'other-subj',
      termId: 'term-prelim',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.materials.bulkPut([mat1, mat2, unrelatedMat]);

    // Delete subject
    await repo.deleteSubject(subjectId);

    // 1. Subject itself is removed
    expect(await repo.getSubjectById(subjectId)).toBeNull();

    // 2. Cascade invariant: associated subjectTerms removed, unrelated kept
    const remainingLinks = await db.subjectTerms.where('subjectId').equals(subjectId).toArray();
    expect(remainingLinks).toHaveLength(0);
    const otherLinks = await db.subjectTerms.where('subjectId').equals('other-subj').toArray();
    expect(otherLinks).toHaveLength(1);

    // 3. Cascade invariant: materials have subjectId and termId cleared to undefined
    const updatedMat1 = await db.materials.get('mat-1');
    const updatedMat2 = await db.materials.get('mat-2');
    expect(updatedMat1?.subjectId).toBeUndefined();
    expect(updatedMat1?.termId).toBeUndefined();
    expect(updatedMat2?.subjectId).toBeUndefined();
    expect(updatedMat2?.termId).toBeUndefined();

    // Unrelated material was untouched
    const untouchedMat = await db.materials.get('mat-unrelated');
    expect(untouchedMat?.subjectId).toBe('other-subj');
    expect(untouchedMat?.termId).toBe('term-prelim');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(repo.getSubjects(controller.signal)).rejects.toThrow();
    await expect(repo.getSubjectById('subj-1', controller.signal)).rejects.toThrow();
  });
});
