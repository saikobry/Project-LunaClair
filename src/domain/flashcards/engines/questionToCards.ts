import type { Question } from '../../quiz/models/Question';
import type { Flashcard, FlashcardBase, FlashcardChoice } from '../models/Flashcard';
import { cardKeyForBlank, cardKeyForQuestion } from './cardKey';

/** The marker an authored `fill_in_blank` template carries once per answer. */
const BLANK_MARKER = '___';

/** How many `___` markers a resolved cloze front carries. */
function countBlankMarkers(text: string): number {
    return text.split(BLANK_MARKER).length - 1;
}

/**
 * Anki-style cloze front for one target blank: that blank stays a marker, every
 * other blank is filled with its own answer. The other answers are retrieval
 * context and scaffolding — hiding all of them would leave the reader guessing
 * which fact is under test, and revealing all of them on the back (the old
 * one-card-per-question shape) collapsed N facts into a single rating.
 */
function renderClozeFront(front: string, blanks: string[], target: number): string {
    let seen = -1;
    return front.replaceAll(BLANK_MARKER, () => {
        seen += 1;
        return seen === target ? BLANK_MARKER : blanks[seen] ?? BLANK_MARKER;
    });
}

function buildCard(
    question: Question,
    key: string,
    front: string,
    back: string,
    choices?: FlashcardChoice[]
): Flashcard {
    const shared: FlashcardBase = {
        key,
        source: { type: 'question', questionId: question.id },
        front,
        back,
        explanation: question.explanation,
        materialId: question.materialId,
        tags: question.tags,
        difficulty: question.difficulty,
    };

    if (choices) {
        return { ...shared, kind: 'choice', choices };
    }

    return { ...shared, kind: 'recall' };
}

/**
 * Projects a Question into the cards a learner actually reviews. The result is
 * **0..N per question**: every non-cloze type yields exactly one card, and a
 * `fill_in_blank` question yields one card per blank so each blank carries its
 * own SM-2 schedule. Transient and never persisted — only the card `key` is.
 */
export function questionToCards(question: Question): Flashcard[] {
    const { payload } = question;
    let front = question.prompt;
    let back = '';
    // Only the option-bearing payloads populate this; it is what selects the
    // `choice` variant below.
    let choices: FlashcardChoice[] | undefined;

    switch (payload.type) {
        case 'multiple_choice': {
            const correctChoice = payload.choices[payload.correctIndex] ?? '';
            back = correctChoice;
            choices = payload.choices.map((label, index) => ({
                label,
                correct: index === payload.correctIndex,
            }));
            break;
        }
        case 'multiple_select': {
            const correctChoices = payload.correctIndices
                .map((idx) => payload.choices[idx])
                .filter((c): c is string => Boolean(c));
            back = correctChoices.join(', ');
            const correctIndices = new Set(payload.correctIndices);
            choices = payload.choices.map((label, index) => ({
                label,
                correct: correctIndices.has(index),
            }));
            break;
        }
        case 'true_false': {
            back = payload.correctAnswer ? 'True' : 'False';
            break;
        }
        case 'identification': {
            back = payload.correctAnswer;
            if (payload.acceptedAlternatives && payload.acceptedAlternatives.length > 0) {
                back += ` (Also accepted: ${payload.acceptedAlternatives.join(', ')})`;
            }
            break;
        }
        case 'fill_in_blank': {
            const promptTrimmed = question.prompt.trim();
            const templateTrimmed = payload.template.trim();

            if (!promptTrimmed || promptTrimmed.toLowerCase().includes('fill in the blank')) {
                front = templateTrimmed;
            } else if (promptTrimmed !== templateTrimmed && !promptTrimmed.includes('___')) {
                front = `${promptTrimmed}\n\n${templateTrimmed}`;
            } else {
                front = promptTrimmed;
            }

            // Expansion runs on the *resolved* front, so the legacy
            // prompt-to-template fallback above still decides what each card
            // says, and it is the fallback's output that gets split per blank.
            const expands =
                payload.blanks.length > 0 && countBlankMarkers(front) === payload.blanks.length;

            if (expands) {
                return payload.blanks.map((answer, index) =>
                    buildCard(
                        question,
                        cardKeyForBlank(question.id, index),
                        renderClozeFront(front, payload.blanks, index),
                        answer
                    )
                );
            }

            // No per-blank expansion is possible: the row carries no answers, or
            // its marker count disagrees with them (authoring and AI generation
            // both reject that, so it means a legacy or hand-edited row). It
            // still gets a card — dropping it would silently remove the question
            // from the deck, and guessing a marker/answer pairing would print an
            // answer on the card's own front. The legacy back is the honest
            // fallback: the joined answers, or the template when there are none.
            back = payload.blanks.length > 0 ? payload.blanks.join(', ') : payload.template;
            break;
        }
    }

    return [buildCard(question, cardKeyForQuestion(question.id), front, back, choices)];
}
