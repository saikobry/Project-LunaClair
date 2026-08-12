import type { Question } from '../quiz/Question';
import type { Flashcard } from './Card';

export function questionToCard(question: Question): Flashcard {
    const { payload } = question;
    let front = question.prompt;
    let back = '';

    switch (payload.type) {
        case 'multiple_choice': {
            const correctChoice = payload.choices[payload.correctIndex] ?? '';
            back = correctChoice;
            break;
        }
        case 'multiple_select': {
            const correctChoices = payload.correctIndices
                .map((idx) => payload.choices[idx])
                .filter((c): c is string => Boolean(c));
            back = correctChoices.join(', ');
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

    return {
        key: `q:${question.id}`,
        source: { type: 'question', questionId: question.id },
        type: question.type,
        front,
        back,
        explanation: question.explanation,
        materialId: question.materialId,
        tags: question.tags,
        difficulty: question.difficulty,
    };
}
