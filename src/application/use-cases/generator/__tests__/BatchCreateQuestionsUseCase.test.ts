import { describe, it, expect, vi } from 'vitest';
import { BatchCreateQuestionsUseCase } from '../BatchCreateQuestionsUseCase';
import type { QuestionRepository, CreateQuestionInput } from '../../../../domain/quiz/repositories/QuestionRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { GeneratedQuestionDraft } from '../../../../domain/generator/models/generator.types';
import { validateQuestionDraft } from '../../../../domain/generator/validation/questionDraftValidation';
import { validateQuestionPayload } from '../../../../domain/quiz/validation/questionPayloadValidation';

describe('BatchCreateQuestionsUseCase', () => {
  const mockDrafts: GeneratedQuestionDraft[] = [
    {
      type: 'multiple_choice',
      prompt: 'What is the powerhouse of the cell?',
      payload: {
        type: 'multiple_choice',
        choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
        correctIndex: 1,
      },
      difficulty: 'easy',
      points: 1,
      explanation: 'Mitochondria produce ATP.',
      tags: ['bio'],
    },
  ];

  it('persists drafts in batch defaulting to draft status without stamping a provenance tag', async () => {
    let capturedInputs: CreateQuestionInput[] = [];

    const mockRepo: QuestionRepository = {
      getQuestions: vi.fn(),
      getQuestionById: vi.fn(),
      getQuestionsByIds: vi.fn(),
      createQuestion: vi.fn(),
      createQuestionsBatch: vi.fn(async (inputs: CreateQuestionInput[]): Promise<Question[]> => {
        capturedInputs = inputs;
        return inputs.map((inp, i) => ({
          ...inp,
          id: `q-${i}`,
          difficulty: inp.difficulty ?? 'medium',
          points: inp.points ?? 1,
          status: inp.status ?? 'draft',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    };

    const useCase = new BatchCreateQuestionsUseCase(mockRepo);
    const { created, rejected } = await useCase.execute({
      materialId: 'mat-cell-1',
      questions: mockDrafts,
    });

    expect(created).toHaveLength(1);
    expect(rejected).toEqual([]);
    expect(capturedInputs).toHaveLength(1);
    expect(capturedInputs[0].materialId).toBe('mat-cell-1');
    expect(capturedInputs[0].status).toBe('draft');
    // Persistence adds no marker: the draft's own classification tags are what is stored.
    expect(capturedInputs[0].tags).toEqual(['bio']);
  });

  it('returns an empty result when the input array is empty without invoking repository', async () => {
    const mockRepo: QuestionRepository = {
      getQuestions: vi.fn(),
      getQuestionById: vi.fn(),
      getQuestionsByIds: vi.fn(),
      createQuestion: vi.fn(),
      createQuestionsBatch: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    };

    const useCase = new BatchCreateQuestionsUseCase(mockRepo);
    const result = await useCase.execute({
      materialId: 'mat-cell-1',
      questions: [],
    });

    expect(result).toEqual({ created: [], rejected: [] });
    expect(mockRepo.createQuestionsBatch).not.toHaveBeenCalled();
  });

  describe('the card path (a generated flashcard is a fill_in_blank question)', () => {
    /** Captures exactly what reaches the repository write boundary. */
    function repoCapturingInputs() {
      const captured: CreateQuestionInput[] = [];
      const repo: QuestionRepository = {
        getQuestions: vi.fn(),
        getQuestionById: vi.fn(),
        getQuestionsByIds: vi.fn(),
        createQuestion: vi.fn(),
        createQuestionsBatch: vi.fn(async (inputs: CreateQuestionInput[]): Promise<Question[]> => {
          captured.push(...inputs);
          return inputs.map((inp, i) => ({
            ...inp,
            id: `q-cloze-${i}`,
            difficulty: inp.difficulty ?? 'medium',
            points: inp.points ?? 1,
            status: inp.status ?? 'draft',
            version: 1,
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
          }));
        }),
        updateQuestion: vi.fn(),
        deleteQuestion: vi.fn(),
      };
      return { repo, captured };
    }

    it('persists a cloze draft as a real typed question, not a flattened identification card', async () => {
      const clozeDraft: GeneratedQuestionDraft = {
        type: 'fill_in_blank',
        prompt: 'Fill in the blank with the organelle that generates most cellular ATP.',
        payload: {
          type: 'fill_in_blank',
          template: 'Most ATP is generated in the ___, a double-membraned organelle.',
          blanks: ['mitochondria'],
        },
        difficulty: 'hard',
        points: 1,
        sourceSection: 'Glycolysis',
        tags: ['organelles'],
      };

      const { repo, captured } = repoCapturingInputs();
      await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [clozeDraft],
      });

      expect(captured).toHaveLength(1);
      // The type survives: the retired path stamped every card as `identification`, which
      // made it permanently un-typeable and gave it no per-blank SM-2 schedule.
      expect(captured[0].type).toBe('fill_in_blank');
      expect(captured[0].payload).toEqual(clozeDraft.payload);
      // The `___` marker and the blanks parity the projection needs is the payload's own,
      // never re-derived at persistence.
      const persisted = captured[0].payload as Extract<GeneratedQuestionDraft['payload'], { type: 'fill_in_blank' }>;
      expect((persisted.template.match(/___/g) ?? []).length).toBe(persisted.blanks.length);
    });

    it('persists the difficulty the draft yielded, instead of hardcoding medium', async () => {
      const { repo, captured } = repoCapturingInputs();

      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: 'fill_in_blank',
              prompt: 'P',
              payload: { type: 'fill_in_blank', template: 'A ___.', blanks: ['B'] },
              difficulty,
              points: 1,
            },
          ],
        });
      }

      // The retired `BatchCreateFlashcardsUseCase` hardcoded 'medium' here, so a generated
      // card could never be anything else. Whatever the prompt yields is what persists.
      expect(captured.map((c) => c.difficulty)).toEqual(['easy', 'medium', 'hard']);
    });

    it('carries the section label to the write boundary, where it is provenance and not a tag', async () => {
      const { repo, captured } = repoCapturingInputs();

      await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [
          {
            type: 'fill_in_blank',
            prompt: 'P',
            payload: { type: 'fill_in_blank', template: 'A ___.', blanks: ['B'] },
            difficulty: 'easy',
            points: 1,
            sourceSection: 'Glycolysis',
            tags: ['bio'],
          },
        ],
      });

      expect(captured[0].sourceSection).toBe('Glycolysis');
      // It is its own field, never folded into the tag list: a section label is provenance
      // metadata, and a tag is something a user filters on.
      expect(captured[0].tags).toEqual(['bio']);
      expect(captured[0].tags).not.toContain('Glycolysis');
    });

    it('leaves the section absent when the draft carries none', async () => {
      const { repo, captured } = repoCapturingInputs();

      await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [
          {
            type: 'fill_in_blank',
            prompt: 'P',
            payload: { type: 'fill_in_blank', template: 'A ___.', blanks: ['B'] },
            difficulty: 'easy',
            points: 1,
          },
        ],
      });

      expect(captured[0].sourceSection).toBeUndefined();
    });
  });

  /**
   * The write boundary must not trust its input.
   *
   * The three-link guarantee — a cloze front always carries a valid `___` marker — is what
   * makes a generated card a card. Without a check here, the guarantee rests entirely on the
   * generator having validated first, which is a convention: a future caller (or a hand-rolled
   * one) could hand this use case a payload that never went through `validateQuestionDraft`,
   * and the card would SILENTLY degrade to a single whole-question card at projection time —
   * a `___`-less template has no marker to hide, so `questionToCards` falls back to the
   * one-card shape and the per-blank schedules never appear. No error, no warning, just a
   * worse study surface.
   */
  describe('the write boundary does not trust its input', () => {
    function repoCapturingInputs() {
      const captured: CreateQuestionInput[] = [];
      const repo: QuestionRepository = {
        getQuestions: vi.fn(),
        getQuestionById: vi.fn(),
        getQuestionsByIds: vi.fn(),
        createQuestion: vi.fn(),
        createQuestionsBatch: vi.fn(async (inputs: CreateQuestionInput[]): Promise<Question[]> => {
          captured.push(...inputs);
          return inputs.map((inp, i) => ({
            ...inp,
            id: `q-${i}`,
            difficulty: inp.difficulty ?? 'medium',
            points: inp.points ?? 1,
            status: inp.status ?? 'draft',
            version: 1,
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
          }));
        }),
        updateQuestion: vi.fn(),
        deleteQuestion: vi.fn(),
      };
      return { repo, captured };
    }

    /** A cloze draft whose template has no `___` marker — the markerless degradation. */
    const markerlessCloze: GeneratedQuestionDraft = {
      type: 'fill_in_blank',
      prompt: 'Fill in the blank.',
      payload: { type: 'fill_in_blank', template: 'Most ATP is generated in mitochondria.', blanks: [] },
      difficulty: 'easy',
      points: 1,
    };

    it('refuses a cloze payload with no ___ marker rather than persisting a degraded card', async () => {
      const { repo, captured } = repoCapturingInputs();

      const { created, rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [markerlessCloze],
      });

      // Nothing reaches persistence: the card would have projected as one whole-question
      // card with its own answer printed on its own front.
      expect(captured).toHaveLength(0);
      expect(created).toEqual([]);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].error).toMatch(/blank placeholder/);
    });

    it('refuses a cloze payload whose blanks disagree with its markers', async () => {
      const { repo, captured } = repoCapturingInputs();

      // Two markers, one answer. Repairing this would mean inventing an answer the model
      // never supplied, so the item is dropped and named instead.
      const mismatched: GeneratedQuestionDraft = {
        type: 'fill_in_blank',
        prompt: 'Fill in both blanks.',
        payload: { type: 'fill_in_blank', template: 'The ___ contains the ___.', blanks: ['nucleus'] },
        difficulty: 'easy',
        points: 1,
      };

      const { created, rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [mismatched],
      });

      expect(captured).toHaveLength(0);
      expect(created).toEqual([]);
      expect(rejected[0].error).toMatch(/one answer per ___ placeholder/);
    });

    /**
     * The validator NORMALIZES as it validates. Writing the raw draft instead of its normalized
     * output means a draft can pass this gate and still be persisted exactly as malformed as it
     * arrived — which is what made "every ingress validates" true only by accident. Each case
     * below is a real normalisation the validator performs, asserted at the persistence boundary.
     */
    describe('persists the validator NORMALIZED output, not the raw draft', () => {
      it('adopts the payload type when the top-level type is unusable, instead of persisting it', async () => {
        const { repo, captured } = repoCapturingInputs();

        // The observed `_false` slip: the model drops the leading token of `true_false`. The
        // payload carries a real type, so the validator salvages the item — and persisting the
        // raw draft would store `type: '_false'`, which is not a `QuestionType` at all.
        const { created, rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: '_false',
              prompt: 'Plant cells have cell walls.',
              payload: { type: 'true_false', correctAnswer: true },
              difficulty: 'easy',
              points: 1,
            } as unknown as GeneratedQuestionDraft,
          ],
        });

        expect(rejected).toEqual([]);
        expect(created).toHaveLength(1);
        expect(captured).toHaveLength(1);
        expect(captured[0].type).toBe('true_false');
        expect(captured[0].payload).toEqual({ type: 'true_false', correctAnswer: true });
        // The persisted row must itself pass the Question Bank's payload rule.
        expect(validateQuestionPayload(captured[0].type, captured[0].payload)).toEqual([]);
      });

      it('defaults a non-boolean true_false answer rather than persisting the raw value', async () => {
        const { repo, captured } = repoCapturingInputs();

        // `validateQuestionDraft` defaults this to `true`. The raw value would pass the gate and
        // then be stored, so the deck would read a non-boolean where the projection expects one.
        const { rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: 'true_false',
              prompt: 'Plant cells have cell walls.',
              payload: { type: 'true_false', correctAnswer: 'yes' },
              difficulty: 'easy',
              points: 1,
            } as unknown as GeneratedQuestionDraft,
          ],
        });

        expect(rejected).toEqual([]);
        expect(captured).toHaveLength(1);
        expect(captured[0].payload).toEqual({ type: 'true_false', correctAnswer: true });
        expect(validateQuestionPayload(captured[0].type, captured[0].payload)).toEqual([]);
      });

      it('drops the blank choices the validator filtered out, rather than persisting them', async () => {
        const { repo, captured } = repoCapturingInputs();

        const { rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: 'multiple_choice',
              prompt: 'What is the powerhouse of the cell?',
              payload: {
                type: 'multiple_choice',
                choices: ['Nucleus', '   ', 'Mitochondria', ''],
                correctIndex: 0,
              },
              difficulty: 'easy',
              points: 1,
            } as unknown as GeneratedQuestionDraft,
          ],
        });

        expect(rejected).toEqual([]);
        expect(captured).toHaveLength(1);
        // The validator resolves the index against the FILTERED choices, so persisting the raw
        // choices alongside it would point the correct answer at the wrong text.
        expect(captured[0].payload).toEqual({
          type: 'multiple_choice',
          choices: ['Nucleus', 'Mitochondria'],
          correctIndex: 0,
        });
        expect(validateQuestionPayload(captured[0].type, captured[0].payload)).toEqual([]);
      });

      it('drops the blank accepted alternatives the validator filtered out', async () => {
        const { repo, captured } = repoCapturingInputs();

        const { rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: 'identification',
              prompt: 'What is the capital of Japan?',
              payload: {
                type: 'identification',
                correctAnswer: 'Tokyo',
                acceptedAlternatives: ['Edo', '  '],
              },
              difficulty: 'easy',
              points: 1,
            } as unknown as GeneratedQuestionDraft,
          ],
        });

        expect(rejected).toEqual([]);
        expect(captured).toHaveLength(1);
        expect(captured[0].payload).toEqual({
          type: 'identification',
          correctAnswer: 'Tokyo',
          acceptedAlternatives: ['Edo'],
        });
        expect(validateQuestionPayload(captured[0].type, captured[0].payload)).toEqual([]);
      });

      it('persists a non-array acceptedAlternatives as absent, not as the raw value', async () => {
        const { repo, captured } = repoCapturingInputs();

        // A string alternatives value is a `TypeError` on `.map` in the grader. The validator
        // normalizes it to `undefined`; persisting the raw value would reintroduce the exact
        // shape the defensive guards elsewhere had to absorb.
        const { rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [
            {
              type: 'identification',
              prompt: 'What is the capital of Japan?',
              payload: {
                type: 'identification',
                correctAnswer: 'Tokyo',
                acceptedAlternatives: 'Edo',
              },
              difficulty: 'easy',
              points: 1,
            } as unknown as GeneratedQuestionDraft,
          ],
        });

        expect(rejected).toEqual([]);
        expect(captured).toHaveLength(1);
        expect(captured[0].payload).toEqual({ type: 'identification', correctAnswer: 'Tokyo' });
        expect(validateQuestionPayload(captured[0].type, captured[0].payload)).toEqual([]);
      });
    });

    it('salvages the batch: valid siblings are still persisted when one item is refused', async () => {
      const { repo, captured } = repoCapturingInputs();

      const good: GeneratedQuestionDraft = {
        type: 'fill_in_blank',
        prompt: 'Fill in the blank with the organelle that generates most cellular ATP.',
        payload: {
          type: 'fill_in_blank',
          template: 'Most ATP is generated in the ___, a double-membraned organelle.',
          blanks: ['mitochondria'],
        },
        difficulty: 'easy',
        points: 1,
      };

      const { created, rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: [markerlessCloze, good, mismatchedInline()],
      });

      // Salvage, not all-or-nothing: one bad item must not discard its valid sibling.
      expect(captured).toHaveLength(1);
      expect(captured[0].payload).toEqual(good.payload);
      expect(created).toHaveLength(1);
      // The refusal names the offending positions, so a shortfall is legible.
      expect(rejected.map((r) => r.index)).toEqual([0, 2]);
    });

    it('does not report anything for a batch the generator already validated', async () => {
      const { repo } = repoCapturingInputs();

      // This is what the live path does: `GenerateQuestionsUseCase` hands over only drafts
      // that already passed the SAME validator, so the boundary's re-check is a no-op there
      // and never double-reports an item the generator dropped (those never arrive at all).
      const { rejected } = await new BatchCreateQuestionsUseCase(repo).execute({
        materialId: 'mat-cell-1',
        questions: validateAll([
          {
            type: 'fill_in_blank',
            prompt: 'Fill in the blank.',
            payload: { type: 'fill_in_blank', template: 'Most ATP is generated in the ___.', blanks: ['mitochondria'] },
            difficulty: 'easy',
            points: 1,
          },
          {
            type: 'multiple_choice',
            prompt: 'Which organelle?',
            payload: { type: 'multiple_choice', choices: ['Mitochondria', 'Nucleus'], correctIndex: 0 },
            difficulty: 'easy',
            points: 1,
          },
        ]),
      });

      expect(rejected).toEqual([]);
    });

    it('never repairs a refused payload into a persistable one', async () => {
      const { repo, captured } = repoCapturingInputs();

      // A second attempt with the same bad input must be refused identically — the boundary
      // is a gate, not a transform, so there is no "first time through" that gets a fix-up.
      for (let i = 0; i < 2; i++) {
        await new BatchCreateQuestionsUseCase(repo).execute({
          materialId: 'mat-cell-1',
          questions: [markerlessCloze],
        });
      }

      expect(captured).toHaveLength(0);
    });

    /** A second invalid item, so the salvage test can assert per-item indices. */
    function mismatchedInline(): GeneratedQuestionDraft {
      return {
        type: 'fill_in_blank',
        prompt: 'Fill in both blanks.',
        payload: { type: 'fill_in_blank', template: 'The ___ contains the ___.', blanks: ['nucleus'] },
        difficulty: 'easy',
        points: 1,
      };
    }

    /**
     * Runs raw drafts through the domain validator the generator uses, so these tests build
     * the *same* input population the live path delivers. It is imported here rather than
     * hand-written as valid data because the point of the "no double-report" case is that
     * generator-validated drafts are, by construction, boundary-valid.
     */
    function validateAll(drafts: unknown[]): GeneratedQuestionDraft[] {
      return drafts.map((draft) => {
        const result = validateQuestionDraft(draft);
        if (!result.success) throw new Error(`fixture is not a valid draft: ${result.error}`);
        return result.data;
      });
    }
  });
});
