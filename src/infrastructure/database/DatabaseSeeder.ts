import type { LunaClairDatabase } from './LunaClairDatabase';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz } from '../../domain/quiz/Quiz';

/**
 * Seeds the database with demo content if empty.
 * Creates default anatomy material, representative sample questions
 * for all 5 question types, and a starter quiz.
 */
export class DatabaseSeeder {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase) {
        this.database = database;
    }

    async seedIfEmpty(): Promise<void> {
        const materialCount = await this.database.materials.count();
        if (materialCount > 0) return;

        const now = new Date().toISOString();
        const materialId = 'anatomy-physiology';

        const material: StudyMaterial = {
            id: materialId,
            title: 'Anatomy & Physiology: Body Membranes',
            description:
                'Covering the integumentary system, skin structure, membranes, and common pathologies.',
            sourceType: 'bundled',
            sourceId: 'anatomy-physiology',
            createdAt: now,
            updatedAt: now,
        };

        const questions = this.buildSampleQuestions(materialId, now);
        const quiz = this.buildStarterQuiz(materialId, questions, now);

        await this.database.transaction(
            'rw',
            [this.database.materials, this.database.questions, this.database.quizzes],
            async () => {
                await this.database.materials.put(material);
                await this.database.questions.bulkPut(questions);
                await this.database.quizzes.put(quiz);
            },
        );
    }

    private buildSampleQuestions(materialId: string, now: string): Question[] {
        return [
            {
                id: 'q-mc-001',
                materialId,
                type: 'multiple_choice',
                prompt: 'Which layer of the skin contains blood vessels and nerves?',
                payload: {
                    type: 'multiple_choice',
                    choices: ['Epidermis', 'Dermis', 'Hypodermis', 'Stratum corneum'],
                    correctIndex: 1,
                },
                difficulty: 'easy',
                points: 1,
                explanation: 'The dermis is the vascular layer containing blood vessels, nerves, and hair follicles.',
                tags: ['skin', 'layers'],
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-ms-001',
                materialId,
                type: 'multiple_select',
                prompt: 'Which of the following are functions of the integumentary system? (Select all that apply)',
                payload: {
                    type: 'multiple_select',
                    choices: [
                        'Protection against pathogens',
                        'Vitamin D synthesis',
                        'Oxygen transport',
                        'Thermoregulation',
                    ],
                    correctIndices: [0, 1, 3],
                },
                difficulty: 'medium',
                points: 2,
                explanation: 'The integumentary system protects, synthesizes vitamin D, and regulates temperature. Oxygen transport is a cardiovascular function.',
                tags: ['integumentary', 'functions'],
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-tf-001',
                materialId,
                type: 'true_false',
                prompt: 'The epidermis is the deepest layer of the skin.',
                payload: {
                    type: 'true_false',
                    correctAnswer: false,
                },
                difficulty: 'easy',
                points: 1,
                explanation: 'The hypodermis (subcutaneous layer) is the deepest. The epidermis is the outermost layer.',
                tags: ['skin', 'layers'],
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-id-001',
                materialId,
                type: 'identification',
                prompt: 'What is the protein that provides waterproofing to the outer layer of skin?',
                payload: {
                    type: 'identification',
                    correctAnswer: 'keratin',
                    acceptedAlternatives: ['keratin protein'],
                },
                difficulty: 'medium',
                points: 2,
                explanation: 'Keratin is the fibrous protein that waterproofs and strengthens skin cells.',
                tags: ['proteins', 'skin'],
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-fb-001',
                materialId,
                type: 'fill_in_blank',
                prompt: 'Complete the statement about skin layers.',
                payload: {
                    type: 'fill_in_blank',
                    template: 'The skin consists of three primary layers: the ___, the ___, and the ___.',
                    blanks: ['epidermis', 'dermis', 'hypodermis'],
                },
                difficulty: 'medium',
                points: 3,
                explanation: 'From superficial to deep: epidermis, dermis, and hypodermis (subcutaneous tissue).',
                tags: ['skin', 'layers'],
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
        ];
    }

    private buildStarterQuiz(materialId: string, questions: Question[], now: string): Quiz {
        return {
            id: 'quiz-anatomy-001',
            materialId,
            title: 'Body Membranes — Practice Quiz',
            description: 'A mixed-format practice quiz covering skin structure and integumentary functions.',
            questionIds: questions.map((q) => q.id),
            passingPercentage: 70,
            createdAt: now,
            updatedAt: now,
        };
    }
}
