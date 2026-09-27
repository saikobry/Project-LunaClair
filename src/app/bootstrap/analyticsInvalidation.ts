import type { SaveQuizUseCase } from '../../application/use-cases/quiz-management/SaveQuizUseCase';
import type { QuestionRepository } from '../../domain/quiz/repositories/QuestionRepository';

/**
 * Cross-feature cache coordination, owned by the composition root.
 *
 * The `['analytics']` cache is derived from exactly three inputs: the projected
 * card pool (questions), the review rows, and completed quiz sessions. Reviews
 * and sessions are invalidated by the features that write them
 * (`useFlashcardRating`, `useQuizPersistence`). **Questions had no invalidator**,
 * and the obvious place for one — the quiz-management authoring hooks — cannot
 * hold it: naming the analytics cache key from there would add a
 * `quiz-management -> analytics` feature edge, and the feature DAG in
 * `src/features/AGENTS.md` is a test-enforced contract with `analytics`
 * declared as having zero feature-to-feature dependencies.
 *
 * So the coordination lives here, in the app layer, which is the one layer that
 * legitimately sees both features: `app -> features` is the allowed direction,
 * so neither feature has to know the other exists. The composition root wires
 * these decorators into the graph and `ApplicationProvider` binds
 * `invalidateAnalytics` to the app's `QueryClient` — the invalidation therefore
 * happens at the same boundary that assembles the use cases, and neither
 * `features/quiz-management` nor `features/analytics` gains an import.
 *
 * Same key namespace as `useFlashcardRating` / `useQuizPersistence`: the
 * literal `['analytics']` prefix owned by the analytics feature's
 * `analyticsQueryKeys.all()`.
 */
export const ANALYTICS_QUERY_KEY: readonly string[] = ['analytics'];

/**
 * Drops the `['analytics']` cache namespace. Supplied by the app shell
 * (`ApplicationProvider`) so this module never touches TanStack Query itself,
 * which keeps the composition root free of a query-cache dependency.
 */
export type AnalyticsCacheInvalidator = () => void;

/** A no-op invalidator: the default for a graph assembled outside the shell. */
export const noopAnalyticsCacheInvalidator: AnalyticsCacheInvalidator = () => {};

/**
 * `SaveQuizUseCase` reduced to its public surface. The decorator is a plain
 * object, not a subclass, so the private members of the class are irrelevant to
 * the composition root's declared type — and features only ever call `execute`.
 */
export type SaveQuizOperation = Pick<SaveQuizUseCase, 'execute'>;

/**
 * Wraps a question write so the analytics pool is recomputed after it.
 *
 * Every question mutation goes through `QuestionRepository` **except** the quiz
 * canvas save, which writes through `QuizEditorService` — hence the second
 * decorator below. Reads pass straight through; only writes notify, and only
 * after they have actually succeeded, so a rejected write never costs a
 * refetch.
 *
 * The wrapped repository is otherwise the same object graph: `Question` rows,
 * versions, and tag normalization are untouched.
 */
export function withAnalyticsPoolInvalidation(
    questions: QuestionRepository,
    invalidateAnalytics: AnalyticsCacheInvalidator,
): QuestionRepository {
    return {
        getQuestions: (materialId, signal) => questions.getQuestions(materialId, signal),
        getQuestionById: (id, signal) => questions.getQuestionById(id, signal),
        getQuestionsByIds: (ids, signal) => questions.getQuestionsByIds(ids, signal),

        createQuestion: async (input) => {
            const created = await questions.createQuestion(input);
            invalidateAnalytics();
            return created;
        },
        createQuestionsBatch: async (inputs) => {
            const created = await questions.createQuestionsBatch(inputs);
            invalidateAnalytics();
            return created;
        },
        updateQuestion: async (id, input) => {
            const updated = await questions.updateQuestion(id, input);
            invalidateAnalytics();
            return updated;
        },
        deleteQuestion: async (id) => {
            await questions.deleteQuestion(id);
            // The clearest case of all: a deletion shrinks the pool and clears
            // the deleted question's review rows in the same transaction.
            invalidateAnalytics();
        },
    };
}

/**
 * Wraps the quiz canvas save so the analytics pool is recomputed after a
 * successful commit.
 *
 * This path is separate because `SaveQuizUseCase` writes questions through
 * `QuizEditorService`, not through `QuestionRepository`, so the repository
 * decorator above never sees it. A **validation failure** writes nothing, so it
 * must not invalidate — `success: false` returns the author's errors and the
 * committed pool is unchanged.
 */
export function withAnalyticsPoolInvalidationOnSave(
    saveQuiz: SaveQuizUseCase,
    invalidateAnalytics: AnalyticsCacheInvalidator,
): SaveQuizOperation {
    return {
        execute: async (draft) => {
            const result = await saveQuiz.execute(draft);
            if (result.success) invalidateAnalytics();
            return result;
        },
    };
}
