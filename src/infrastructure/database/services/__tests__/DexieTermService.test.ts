import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieTermService } from '../DexieTermService';
import type { Subject } from '../../../../domain/library/models/Subject';

describe('DexieTermService', () => {
  let db: LunaClairDatabase;
  let service: DexieTermService;

  beforeEach(async () => {
    db = new LunaClairDatabase(`test-term-service-${Math.random().toString(36).slice(2)}`);
    await db.open();
    service = new DexieTermService(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('rejects empty or whitespace-only title', async () => {
    await expect(service.createAndAssignTerm('subj-1', '')).rejects.toThrow(
      'createAndAssignTerm: title must not be empty',
    );
    await expect(service.createAndAssignTerm('subj-1', '   ')).rejects.toThrow(
      'createAndAssignTerm: title must not be empty',
    );
  });

  it('throws when subject does not exist', async () => {
    await expect(service.createAndAssignTerm('non-existent-subj', 'Prelim')).rejects.toThrow(
      'Subject not found: non-existent-subj',
    );
  });

  it('atomically creates term and subjectTerm junction with order = max(order) + 1', async () => {
    const subject: Subject = {
      id: 'subj-bio',
      title: 'Biology',
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await db.subjects.put(subject);

    // First term
    const res1 = await service.createAndAssignTerm('subj-bio', 'Prelim');
    expect(res1.term.title).toBe('Prelim');
    expect(res1.subjectTerm.subjectId).toBe('subj-bio');
    expect(res1.subjectTerm.termId).toBe(res1.term.id);
    expect(res1.subjectTerm.order).toBe(1);

    // Second term
    const res2 = await service.createAndAssignTerm('subj-bio', 'Midterm');
    expect(res2.term.title).toBe('Midterm');
    expect(res2.subjectTerm.order).toBe(2);

    // Verify stored records in Dexie
    const storedTerm = await db.terms.get(res1.term.id);
    expect(storedTerm).toEqual(res1.term);

    const storedLinks = await db.subjectTerms.where('subjectId').equals('subj-bio').sortBy('order');
    expect(storedLinks).toHaveLength(2);
    expect(storedLinks.map((l) => l.order)).toEqual([1, 2]);
  });

  it('rolls back term creation if subjectTerm junction persistence fails', async () => {
    const subject: Subject = {
      id: 'subj-chem',
      title: 'Chemistry',
      order: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await db.subjects.put(subject);

    // Failure injection: intercept subjectTerms.put and force an error
    vi.spyOn(db.subjectTerms, 'put').mockRejectedValueOnce(
      new Error('Simulated subjectTerm write failure'),
    );

    await expect(service.createAndAssignTerm('subj-chem', 'Finals')).rejects.toThrow(
      'Simulated subjectTerm write failure',
    );

    // Invariant: no orphaned terms or subjectTerms in the database
    const termsCount = await db.terms.count();
    const linksCount = await db.subjectTerms.count();
    expect(termsCount).toBe(0);
    expect(linksCount).toBe(0);
  });
});
