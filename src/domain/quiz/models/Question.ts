import type { QuestionType } from './QuestionType';
import type { QuestionAnswerPayload } from './AnswerPayload';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'published' | 'archived';

export interface Question {
    id: string;
    materialId: string;
    type: QuestionType;
    prompt: string;
    payload: QuestionAnswerPayload;
    difficulty: QuestionDifficulty;
    points: number;
    explanation?: string;
    tags?: string[];
    /**
     * **Provenance metadata, not a tag and not a citation.** The section label captured at
     * generation time — the document heading the grounding resolver was inside when the
     * model was asked. It answers "where did this come from when I generated it?", and
     * nothing more: the document is editable afterwards, so the label is deliberately NOT
     * a pointer into the current document and is never resolved against it. A label that
     * has since gone stale is the honest record; a live link that silently points at the
     * wrong section is not.
     *
     * Optional and unindexed, so it needs no Dexie schema version. Portable: it travels in
     * a `.lcpack` (`PackageQuestion.sourceSection`) and is validated by both the client and
     * the Worker.
     */
    sourceSection?: string;
    status: QuestionStatus;
    version: number;
    createdAt: string;
    updatedAt: string;
}
