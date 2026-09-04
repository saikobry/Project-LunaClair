import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../schema/LunaClairDatabase';
import { dexieSubjectTermRepository, DexieSubjectTermRepository } from '../DexieSubjectTermRepository';
import type { Subject } from '../../../../domain/library/models/Subject';
import type { Term } from '../../../../domain/library/models/Term';

describe('DexieSubjectTermRepository', () => {
  let repo: DexieSubjectTermRepository;

  const now = '2026-01-01T00:00:00.000Z';

  beforeEach(async () => {
    await Promise.all([
      db.subjects.clear(),
      db.terms.clear(),
      db.subjectTerms.clear(),
    ]);
    repo = dexieSubjectTermRepository;
  });

  afterEach(async () => {
    await Promise.all([
      db.subjects.clear(),
      db.terms.clear(),
      db.subjectTerms.clear(),
    ]);
  });

  async function seedSubjectAndTerms(termIds: string[]) {
    const subject: Subject = {
      id: 'subj-1',
      title: 'Math',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.subjects.put(subject);

    const terms: Term[] = termIds.map((id) => ({
      id,
      title: `Term ${id}`,
      createdAt: now,
      updatedAt: now,
    }));
    await db.terms.bulkPut(terms);
  }

  it('enforces composite key and calculates auto-incrementing order on addTerm', async () => {
    await seedSubjectAndTerms(['t-1', 't-2']);

    // Add first term
    await repo.addTerm('subj-1', 't-1');
    expect(await repo.hasTerm('subj-1', 't-1')).toBe(true);

    const link1 = await db.subjectTerms.get(['subj-1', 't-1']);
    expect(link1?.order).toBe(1);

    // Add second term -> order 2
    await repo.addTerm('subj-1', 't-2');
    const link2 = await db.subjectTerms.get(['subj-1', 't-2']);
    expect(link2?.order).toBe(2);

    // Adding existing term again throws duplicate error
    await expect(repo.addTerm('subj-1', 't-1')).rejects.toThrow(
      'Term "t-1" is already linked to subject "subj-1"',
    );
  });

  it('validates subject and term existence in addTerm', async () => {
    await seedSubjectAndTerms(['t-1']);

    await expect(repo.addTerm('non-existent-subj', 't-1')).rejects.toThrow(
      'Subject not found: non-existent-subj',
    );
    await expect(repo.addTerm('subj-1', 'non-existent-term')).rejects.toThrow(
      'Term not found: non-existent-term',
    );
  });

  it('strictly enforces replacement semantics in syncTerms', async () => {
    await seedSubjectAndTerms(['A', 'B', 'C', 'D']);

    // Seed existing links [A, B, C]
    await repo.addTerm('subj-1', 'A'); // order 1
    await repo.addTerm('subj-1', 'B'); // order 2
    await repo.addTerm('subj-1', 'C'); // order 3

    // Sync with [B, D]
    await repo.syncTerms('subj-1', ['B', 'D']);

    // Strictly [B, D] remain, in that exact order (order: 1 for B, 2 for D)
    const views = await repo.getSubjectTermViews('subj-1');
    expect(views).toHaveLength(2);
    expect(views[0].term.id).toBe('B');
    expect(views[0].order).toBe(1);
    expect(views[1].term.id).toBe('D');
    expect(views[1].order).toBe(2);

    // Unreferenced terms A and C are completely purged from subjectTerms
    expect(await repo.hasTerm('subj-1', 'A')).toBe(false);
    expect(await repo.hasTerm('subj-1', 'C')).toBe(false);
  });

  it('rejects duplicate term IDs in syncTerms', async () => {
    await seedSubjectAndTerms(['A']);
    await expect(repo.syncTerms('subj-1', ['A', 'A'])).rejects.toThrow(
      'syncTerms: duplicate term IDs in input array',
    );
  });

  it('reorders existing terms', async () => {
    await seedSubjectAndTerms(['t-1', 't-2', 't-3']);
    await repo.addTerm('subj-1', 't-1');
    await repo.addTerm('subj-1', 't-2');
    await repo.addTerm('subj-1', 't-3');

    // Reorder to t-3, t-1, t-2
    await repo.reorderTerms('subj-1', ['t-3', 't-1', 't-2']);

    const terms = await repo.getTermsBySubject('subj-1');
    expect(terms.map((t) => t.id)).toEqual(['t-3', 't-1', 't-2']);
  });

  it('queries subject IDs by term and removes term association', async () => {
    await seedSubjectAndTerms(['term-shared']);
    const subj2: Subject = {
      id: 'subj-2',
      title: 'Physics',
      order: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.subjects.put(subj2);

    await repo.addTerm('subj-1', 'term-shared');
    await repo.addTerm('subj-2', 'term-shared');

    const subjectIds = await repo.getSubjectIdsByTerm('term-shared');
    expect(subjectIds.sort()).toEqual(['subj-1', 'subj-2']);

    // Remove from subj-1
    await repo.removeTerm('subj-1', 'term-shared');
    expect(await repo.hasTerm('subj-1', 'term-shared')).toBe(false);
    expect(await repo.hasTerm('subj-2', 'term-shared')).toBe(true);
  });
});
