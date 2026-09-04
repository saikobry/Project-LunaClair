import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../LunaClairDatabase';
import { dexieQuizDraftRepository, DexieQuizDraftRepository } from '../DexieQuizDraftRepository';
import type { QuizDraft } from '../../../../application/quiz-management/drafts/QuizDraft';

describe('DexieQuizDraftRepository', () => {
  let repo: DexieQuizDraftRepository;

  beforeEach(async () => {
    await db.quizEditingDrafts.clear();
    repo = dexieQuizDraftRepository;
  });

  afterEach(async () => {
    await db.quizEditingDrafts.clear();
  });

  function createDraft(override: Partial<QuizDraft> = {}): QuizDraft {
    return {
      draftId: `draft-${Math.random().toString(36).slice(2)}`,
      materialId: 'mat-1',
      title: 'Crash Recovery Quiz',
      passingPercentage: 75,
      items: [
        {
          tempId: 'temp-q1',
          type: 'true_false',
          prompt: 'Is this draft state?',
          payload: { type: 'true_false', correctAnswer: true },
          points: 5,
          difficulty: 'easy',
        },
      ],
      updatedAt: '2026-08-01T12:00:00.000Z',
      isDirty: true,
      ...override,
    };
  }

  it('saves and retrieves draft by draftId', async () => {
    const draft = createDraft({ draftId: 'draft-abc' });
    await repo.saveDraft(draft);

    const loaded = await repo.getDraft('draft-abc');
    expect(loaded).toEqual(draft);
  });

  it('returns null when draft does not exist', async () => {
    const loaded = await repo.getDraft('non-existent');
    expect(loaded).toBeNull();
  });

  it('deletes draft by draftId', async () => {
    const draft = createDraft({ draftId: 'draft-to-delete' });
    await repo.saveDraft(draft);

    await repo.deleteDraft('draft-to-delete');
    expect(await repo.getDraft('draft-to-delete')).toBeNull();
  });

  it('retrieves the latest draft for a quiz based on updatedAt', async () => {
    const oldDraft = createDraft({
      draftId: 'draft-old',
      quizId: 'quiz-1',
      updatedAt: '2026-08-01T10:00:00.000Z',
      title: 'Older Draft',
    });
    const newDraft = createDraft({
      draftId: 'draft-new',
      quizId: 'quiz-1',
      updatedAt: '2026-08-01T11:00:00.000Z',
      title: 'Newer Draft',
    });

    await repo.saveDraft(oldDraft);
    await repo.saveDraft(newDraft);

    const latest = await repo.getDraftForQuiz('quiz-1');
    expect(latest?.draftId).toBe('draft-new');
    expect(latest?.title).toBe('Newer Draft');
  });

  it('retrieves the latest draft for a material based on updatedAt', async () => {
    const draftA = createDraft({
      draftId: 'draft-mat-old',
      materialId: 'mat-xyz',
      updatedAt: '2026-08-01T08:00:00.000Z',
    });
    const draftB = createDraft({
      draftId: 'draft-mat-new',
      materialId: 'mat-xyz',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    await repo.saveDraft(draftA);
    await repo.saveDraft(draftB);

    const latest = await repo.getDraftForMaterial('mat-xyz');
    expect(latest?.draftId).toBe('draft-mat-new');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(repo.getDraft('draft-1', controller.signal)).rejects.toThrow();
    await expect(repo.getDraftForQuiz('quiz-1', controller.signal)).rejects.toThrow();
    await expect(repo.getDraftForMaterial('mat-1', controller.signal)).rejects.toThrow();
  });
});
