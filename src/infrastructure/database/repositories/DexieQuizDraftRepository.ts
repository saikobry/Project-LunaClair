import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftRepository } from '../../../application/quiz-management/drafts/QuizDraftRepository';
import { db } from '../LunaClairDatabase';

function latestByUpdatedAt(drafts: QuizDraft[]): QuizDraft | null {
    if (drafts.length === 0) return null;
    return drafts.reduce((latest, draft) =>
        draft.updatedAt > latest.updatedAt ? draft : latest,
    );
}

/**
 * Concrete `QuizDraftRepository` implementation backed by the Dexie
 * `quizEditingDrafts` store. Drafts are local crash-recovery snapshots
 * of the canvas authoring session and are independent of the committed
 * Question Bank / Quiz Catalog state.
 */
export class DexieQuizDraftRepository implements QuizDraftRepository {
    async getDraft(draftId: string, signal?: AbortSignal): Promise<QuizDraft | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.quizEditingDrafts.get(draftId)) ?? null;
    }

    async getDraftForQuiz(quizId: string, signal?: AbortSignal): Promise<QuizDraft | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const drafts = await db.quizEditingDrafts.where('quizId').equals(quizId).toArray();
        return latestByUpdatedAt(drafts);
    }

    async getDraftForMaterial(materialId: string, signal?: AbortSignal): Promise<QuizDraft | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const drafts = await db.quizEditingDrafts.where('materialId').equals(materialId).toArray();
        return latestByUpdatedAt(drafts);
    }

    async saveDraft(draft: QuizDraft): Promise<void> {
        await db.quizEditingDrafts.put(draft);
    }

    async deleteDraft(draftId: string): Promise<void> {
        await db.quizEditingDrafts.delete(draftId);
    }
}

export const dexieQuizDraftRepository = new DexieQuizDraftRepository();
