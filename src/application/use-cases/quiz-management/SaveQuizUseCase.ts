import type { Question } from '../../../domain/quiz/models/Question';
import type { QuestionAnswerPayload } from '../../../domain/quiz/models/AnswerPayload';
import type { QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
import type { QuizEditorService, QuizEditorQuestionChange } from '../../../domain/quiz/services/QuizEditorService';
import type { QuizDraft } from '../../quiz-management/drafts/QuizDraft';
import { validateQuizDraft, type QuizDraftErrors } from '../../quiz-management/drafts/quizDraftValidation';

/**
 * Extensible result DTO returned by `SaveQuizUseCase`.
 *
 * `success: false` carries the structured validation error map so the
 * canvas can focus the first invalid card and render inline messages.
 */
export type SaveQuizResult =
    | { success: true; quizId: string; updatedQuestionIds: string[]; warnings?: string[] }
    | { success: false; errors: QuizDraftErrors };

/**
 * Whether two payloads of the same type hold the same answer content — the
 * `questionVersion` bump test.
 *
 * `a` is the **stored** row and `b` the draft item. Both are now read directly: the
 * `Array.isArray` guards that used to sit here existed only because a package the READ
 * tier tolerated could persist an `acceptedAlternatives` / `blanks` that was not an array,
 * and reading one unguarded is a `TypeError` on a quiz the author is trying to re-save.
 * Every ingress to `db.questions` now validates, so the field is an array or is absent —
 * and `acceptedAlternatives` is optional, which is the only absence `?? []` has to cover.
 *
 * This does not soften the bump rule: a stored value read as absent, and a draft that
 * supplies a real one, is a content change and still bumps.
 */
function payloadsEqual(a: QuestionAnswerPayload, b: QuestionAnswerPayload): boolean {
    if (a.type !== b.type) return false;
    switch (a.type) {
        case 'multiple_choice':
            return (
                a.correctIndex === (b as typeof a).correctIndex &&
                a.choices.length === (b as typeof a).choices.length &&
                a.choices.every((choice, i) => choice === (b as typeof a).choices[i])
            );
        case 'multiple_select': {
            const other = b as typeof a;
            const sortedA = a.correctIndices.toSorted((x, y) => x - y);
            const sortedB = other.correctIndices.toSorted((x, y) => x - y);
            return (
                a.choices.length === other.choices.length &&
                a.choices.every((choice, i) => choice === other.choices[i]) &&
                sortedA.length === sortedB.length &&
                sortedA.every((index, i) => index === sortedB[i])
            );
        }
        case 'true_false':
            return a.correctAnswer === (b as typeof a).correctAnswer;
        case 'identification': {
            const other = b as typeof a;
            const altA = a.acceptedAlternatives ?? [];
            const altB = other.acceptedAlternatives ?? [];
            return (
                a.correctAnswer === other.correctAnswer &&
                altA.length === altB.length &&
                altA.every((alt, i) => alt === altB[i])
            );
        }
        case 'fill_in_blank': {
            const other = b as typeof a;
            return (
                a.template === other.template &&
                a.blanks.length === other.blanks.length &&
                a.blanks.every((blank, i) => blank === other.blanks[i])
            );
        }
    }
}

/** Version increment rule: prompt or answer content changes bump `questionVersion`. */
function contentChanged(existing: Question, draftItem: { prompt: string; payload: QuestionAnswerPayload }): boolean {
    return existing.prompt !== draftItem.prompt || !payloadsEqual(existing.payload, draftItem.payload);
}

/**
 * Atomic quiz authoring save.
 *
 * Pipeline: concurrency guard → draft validation → version increment
 * rules per question → single atomic transaction via `QuizEditorService`.
 * Never touches IndexedDB draft storage or React query caches — those
 * lifecycle steps belong to the UI editor layer.
 */
export class SaveQuizUseCase {
    private readonly questions: QuestionRepository;
    private readonly editorService: QuizEditorService;
    private inflight: Promise<SaveQuizResult> | null = null;

    constructor(questions: QuestionRepository, editorService: QuizEditorService) {
        this.questions = questions;
        this.editorService = editorService;
    }

    execute(draft: QuizDraft): Promise<SaveQuizResult> {
        // Concurrency guard — duplicate triggers await the in-flight save.
        if (this.inflight) return this.inflight;
        this.inflight = this.run(draft).finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }

    private async run(draft: QuizDraft): Promise<SaveQuizResult> {
        const errors = validateQuizDraft(draft);
        if (errors) return { success: false, errors };

        const importedIds = draft.items
            .map((item) => item.questionId)
            .filter((id): id is string => Boolean(id));
        const existing = await this.questions.getQuestionsByIds(importedIds);
        const byId = new Map(existing.map((question) => [question.id, question]));

        const questionChanges: QuizEditorQuestionChange[] = draft.items.map((item) => {
            if (item.questionId) {
                const bankQuestion = byId.get(item.questionId);
                const changed = bankQuestion ? contentChanged(bankQuestion, item) : true;
                return {
                    kind: 'update' as const,
                    tempId: item.tempId,
                    questionId: item.questionId,
                    prompt: item.prompt,
                    payload: item.payload,
                    bumpVersion: changed,
                    difficulty: item.difficulty,
                    explanation: item.explanation,
                    tags: item.tags,
                };
            }
            return {
                kind: 'create' as const,
                tempId: item.tempId,
                materialId: draft.materialId,
                type: item.type,
                prompt: item.prompt,
                payload: item.payload,
                points: item.points,
                difficulty: item.difficulty,
                explanation: item.explanation,
                tags: item.tags,
            };
        });

        const result = await this.editorService.saveQuiz({
            materialId: draft.materialId,
            quiz: {
                id: draft.quizId,
                title: draft.title,
                description: draft.description,
                passingPercentage: draft.passingPercentage,
                items: draft.items.map((item, index) => ({
                    tempId: item.tempId,
                    order: index + 1,
                    points: item.points,
                })),
            },
            questionChanges,
        });

        return {
            success: true,
            quizId: result.quiz.id,
            updatedQuestionIds: result.updatedQuestionIds,
        };
    }
}
