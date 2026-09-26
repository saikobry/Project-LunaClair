import type { Question } from '../../quiz/models/Question';
import type { Flashcard, FlashcardBase, FlashcardChoice } from '../models/Flashcard';
import { cardKeyForQuestion } from './cardKey';

export function questionToCard(question: Question): Flashcard {
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

            if (payload.blanks.length > 0) {
                back = payload.blanks.join(', ');
            } else {
                back = payload.template;
            }
            break;
        }
    }

    const shared: FlashcardBase = {
        key: cardKeyForQuestion(question.id),
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
