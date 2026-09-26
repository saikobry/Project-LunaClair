export type FlashcardSource = { type: 'question'; questionId: string };

/** One option on a `choice` card. Several options may be correct. */
export interface FlashcardChoice {
    label: string;
    correct: boolean;
}

/** Properties every projected card carries, whatever its shape. */
export interface FlashcardBase {
    key: string; // `q:${questionId}` — built by `cardKeyForQuestion`
    source: FlashcardSource;
    front: string; // prompt / sentence template
    back: string; // rendered correct answer text
    explanation?: string;
    materialId: string;
    tags?: string[];
    /** The source question's authored difficulty — not a measured property of the card. */
    difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Prompt/answer card: the front face carries everything needed to recall and
 * the back face reveals the answer. Derived from `identification`,
 * `true_false`, and `fill_in_blank` questions.
 */
export interface RecallCard extends FlashcardBase {
    kind: 'recall';
}

/**
 * Multiple-option card: the options are part of the question, so they belong
 * on the front face. Correctness is carried but must not be surfaced until the
 * card is flipped. Derived from `multiple_choice` and `multiple_select`
 * questions.
 */
export interface ChoiceCard extends FlashcardBase {
    kind: 'choice';
    choices: FlashcardChoice[];
}

/**
 * Transient derived projection of a Question — never persisted. The `kind`
 * discriminant describes the card's *shape* (what the front face must present),
 * not the source question type: a `multiple_choice` question whose options were
 * dropped would still be a choice card, just an incoherent one.
 */
export type Flashcard = RecallCard | ChoiceCard;
