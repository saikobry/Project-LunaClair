import type { QuizDraft } from './QuizDraft';

/**
 * Persistence contract for the local crash-recovery draft store
 * (Dexie `quizEditingDrafts`). Drafts are autosaved locally and are
 * independent of the committed Question Bank / Quiz Catalog state.
 */
export interface QuizDraftRepository {
    getDraft(draftId: string, signal?: AbortSignal): Promise<QuizDraft | null>;
    /** Finds the most recent draft for an existing quiz (edit mode). */
    getDraftForQuiz(quizId: string, signal?: AbortSignal): Promise<QuizDraft | null>;
    /** Finds the most recent draft for a material (create-mode recovery). */
    getDraftForMaterial(materialId: string, signal?: AbortSignal): Promise<QuizDraft | null>;
    saveDraft(draft: QuizDraft): Promise<void>;
    deleteDraft(draftId: string): Promise<void>;
}
