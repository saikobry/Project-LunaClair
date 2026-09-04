import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../LunaClairDatabase';
import { DexieQuizEditorService } from '../DexieQuizEditorService';
import type { SaveQuizToRepositoryInput } from '../../../../domain/quiz/services/QuizEditorService';

describe('DexieQuizEditorService', () => {
  let db: LunaClairDatabase;
  let service: DexieQuizEditorService;

  beforeEach(async () => {
    db = new LunaClairDatabase(`test-quiz-editor-${Math.random().toString(36).slice(2)}`);
    await db.open();
    service = new DexieQuizEditorService(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('creates a new quiz with new questions, remapping tempIds, normalizing tags, and snapshotting versions', async () => {
    const input: SaveQuizToRepositoryInput = {
      materialId: 'mat-1',
      quiz: {
        title: 'Cellular Respiration Quiz',
        description: 'Test on ATP',
        passingPercentage: 80,
        items: [
          { tempId: 'card-temp-1', order: 0, points: 5 },
          { tempId: 'card-temp-2', order: 1, points: 10 },
        ],
      },
      questionChanges: [
        {
          kind: 'create',
          tempId: 'card-temp-1',
          materialId: 'mat-1',
          type: 'multiple_choice',
          prompt: 'What is ATP?',
          payload: {
            type: 'multiple_choice',
            choices: ['Energy currency', 'Protein', 'Lipid', 'Carb'],
            correctIndex: 0,
          },
          difficulty: 'easy',
          points: 5,
          tags: ['#biology', 'CELLS', 'biology'], // duplicates and # should be normalized
        },
        {
          kind: 'create',
          tempId: 'card-temp-2',
          materialId: 'mat-1',
          type: 'true_false',
          prompt: 'Glycolysis requires oxygen.',
          payload: {
            type: 'true_false',
            correctAnswer: false,
          },
          points: 10,
          tags: ['respiration'],
        },
      ],
    };

    const result = await service.saveQuiz(input);

    expect(result.quiz.id).toBeDefined();
    expect(result.quiz.title).toBe('Cellular Respiration Quiz');
    expect(result.quiz.passingPercentage).toBe(80);
    expect(result.quiz.questionIds).toHaveLength(2);
    expect(result.quiz.items).toHaveLength(2);

    // TempIds remapped to real IDs
    const q1Id = result.quiz.items[0].questionId;
    const q2Id = result.quiz.items[1].questionId;
    expect(q1Id).toMatch(/^q-/);
    expect(q2Id).toMatch(/^q-/);
    expect(q1Id).not.toBe('card-temp-1');
    expect(q2Id).not.toBe('card-temp-2');

    // Question version snapshot
    expect(result.quiz.items[0].questionVersion).toBe(1);
    expect(result.quiz.items[1].questionVersion).toBe(1);

    // Questions persisted in DB
    const q1 = await db.questions.get(q1Id);
    expect(q1).toBeDefined();
    expect(q1?.prompt).toBe('What is ATP?');
    expect(q1?.version).toBe(1);
    // Normalized tags: #biology, CELLS, biology -> ['biology', 'CELLS']
    expect(q1?.tags).toEqual(['biology', 'CELLS']);

    const q2 = await db.questions.get(q2Id);
    expect(q2).toBeDefined();
    expect(q2?.version).toBe(1);
  });

  it('updates existing questions with conditional version bump', async () => {
    // 1. Initial creation
    const initialInput: SaveQuizToRepositoryInput = {
      materialId: 'mat-1',
      quiz: {
        title: 'Initial Quiz',
        items: [{ tempId: 't-1', order: 0, points: 5 }],
      },
      questionChanges: [
        {
          kind: 'create',
          tempId: 't-1',
          materialId: 'mat-1',
          type: 'multiple_choice',
          prompt: 'Initial prompt',
          payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
          points: 5,
          tags: [],
        },
      ],
    };
    const initialResult = await service.saveQuiz(initialInput);
    const existingQId = initialResult.quiz.questionIds[0];
    const existingQuizId = initialResult.quiz.id;

    // 2. Save with metadata-only change (bumpVersion: false)
    const updateNoBump: SaveQuizToRepositoryInput = {
      materialId: 'mat-1',
      quiz: {
        id: existingQuizId,
        title: 'Updated Quiz Title',
        items: [{ tempId: 't-existing', order: 0, points: 5 }],
      },
      questionChanges: [
        {
          kind: 'update',
          tempId: 't-existing',
          questionId: existingQId,
          prompt: 'Fixed minor typo in prompt',
          payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
          explanation: 'Added explanation',
          bumpVersion: false,
        },
      ],
    };
    const resNoBump = await service.saveQuiz(updateNoBump);
    expect(resNoBump.updatedQuestionIds).toHaveLength(0);
    const qAfterNoBump = await db.questions.get(existingQId);
    expect(qAfterNoBump?.version).toBe(1);
    expect(qAfterNoBump?.explanation).toBe('Added explanation');
    expect(resNoBump.quiz.items[0].questionVersion).toBe(1);

    // 3. Save with content change (bumpVersion: true)
    const updateWithBump: SaveQuizToRepositoryInput = {
      materialId: 'mat-1',
      quiz: {
        id: existingQuizId,
        title: 'Updated Quiz Title',
        items: [{ tempId: 't-existing', order: 0, points: 5 }],
      },
      questionChanges: [
        {
          kind: 'update',
          tempId: 't-existing',
          questionId: existingQId,
          prompt: 'Significantly altered prompt and options',
          payload: { type: 'multiple_choice', choices: ['A', 'B', 'C'], correctIndex: 2 },
          bumpVersion: true,
        },
      ],
    };
    const resWithBump = await service.saveQuiz(updateWithBump);
    expect(resWithBump.updatedQuestionIds).toContain(existingQId);
    const qAfterBump = await db.questions.get(existingQId);
    expect(qAfterBump?.version).toBe(2);
    expect(resWithBump.quiz.items[0].questionVersion).toBe(2);
  });

  it('rolls back question creations and updates if quiz persistence fails', async () => {
    const input: SaveQuizToRepositoryInput = {
      materialId: 'mat-fail',
      quiz: {
        title: 'Failing Quiz',
        items: [{ tempId: 't-fail-1', order: 0, points: 10 }],
      },
      questionChanges: [
        {
          kind: 'create',
          tempId: 't-fail-1',
          materialId: 'mat-fail',
          type: 'true_false',
          prompt: 'Should be rolled back',
          payload: { type: 'true_false', correctAnswer: true },
          points: 10,
          tags: ['rollback'],
        },
      ],
    };

    // Inject failure at quiz write step
    vi.spyOn(db.quizzes, 'put').mockRejectedValueOnce(new Error('Simulated quiz persistence failure'));

    await expect(service.saveQuiz(input)).rejects.toThrow('Simulated quiz persistence failure');

    // Assert questions table was rolled back cleanly
    const questionsCount = await db.questions.count();
    const quizzesCount = await db.quizzes.count();
    expect(questionsCount).toBe(0);
    expect(quizzesCount).toBe(0);
  });
});
