import type { LunaClairDatabase } from './LunaClairDatabase';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { SubjectTerm } from '../../domain/library/SubjectTerm';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz, QuizQuestion } from '../../domain/quiz/Quiz';

/**
 * Seeds the database with demo content if empty.
 * Creates subjects, global terms, subject-term links, categorized materials,
 * uncategorized material, sample questions for all 5 question types, and starter quizzes.
 */
export class DatabaseSeeder {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase) {
        this.database = database;
    }

    async seedIfEmpty(): Promise<void> {
        const subjectCount = await this.database.subjects.count();
        if (subjectCount > 0) return;

        const now = new Date().toISOString();

        // ── Subjects ──────────────────────────────────────────
        const bioSubject: Subject = {
            id: 'subject-bio-101',
            title: 'Biology 101',
            description: 'Introduction to biology — cells, respiration, photosynthesis, and genetics.',
            order: 1,
            createdAt: now,
            updatedAt: now,
        };

        const historySubject: Subject = {
            id: 'subject-world-history',
            title: 'World History',
            description: 'Ancient civilizations, world wars, and modern global history.',
            order: 2,
            createdAt: now,
            updatedAt: now,
        };

        // ── Global Terms (standalone, no subjectId) ──────────
        const terms: Term[] = [
            { id: 'term-prelim', title: 'Prelim', createdAt: now, updatedAt: now },
            { id: 'term-midterm', title: 'Midterm', createdAt: now, updatedAt: now },
            { id: 'term-finals', title: 'Finals', createdAt: now, updatedAt: now },
        ];

        // ── SubjectTerm Links ────────────────────────────────
        const subjectTerms: SubjectTerm[] = [
            // Biology: Prelim, Midterm, Finals
            { subjectId: 'subject-bio-101', termId: 'term-prelim', order: 1 },
            { subjectId: 'subject-bio-101', termId: 'term-midterm', order: 2 },
            { subjectId: 'subject-bio-101', termId: 'term-finals', order: 3 },
            // World History: Prelim, Midterm, Finals
            { subjectId: 'subject-world-history', termId: 'term-prelim', order: 1 },
            { subjectId: 'subject-world-history', termId: 'term-midterm', order: 2 },
            { subjectId: 'subject-world-history', termId: 'term-finals', order: 3 },
        ];

        // ── Materials (categorized + uncategorized) ───────────
        const materials: StudyMaterial[] = [
            // Biology — Prelim
            {
                id: 'cell-structure',
                title: 'Cell Structure & Function',
                description: 'Cell theory, organelles, and membrane transport.',
                sourceType: 'bundled',
                sourceId: 'cell-structure',
                subjectId: 'subject-bio-101',
                termId: 'term-prelim',
                order: 1,
                createdAt: now,
                updatedAt: now,
            },
            // Biology — Midterm
            {
                id: 'cellular-respiration',
                title: 'Cellular Respiration',
                description: 'Glycolysis, Krebs cycle, electron transport chain.',
                sourceType: 'bundled',
                sourceId: 'cellular-respiration',
                subjectId: 'subject-bio-101',
                termId: 'term-midterm',
                order: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'photosynthesis',
                title: 'Photosynthesis',
                description: 'Light-dependent reactions, Calvin cycle, photorespiration.',
                sourceType: 'bundled',
                sourceId: 'photosynthesis',
                subjectId: 'subject-bio-101',
                termId: 'term-midterm',
                order: 2,
                createdAt: now,
                updatedAt: now,
            },
            // Biology — Finals
            {
                id: 'genetics',
                title: 'Genetics & Heredity',
                description: 'Mendelian genetics, DNA replication, protein synthesis, mutations.',
                sourceType: 'bundled',
                sourceId: 'genetics',
                subjectId: 'subject-bio-101',
                termId: 'term-finals',
                order: 1,
                createdAt: now,
                updatedAt: now,
            },
            // World History — Prelim
            {
                id: 'ancient-civilizations',
                title: 'Ancient Civilizations',
                description: 'Mesopotamia, Egypt, Indus Valley, and early Chinese dynasties.',
                sourceType: 'bundled',
                sourceId: 'ancient-civilizations',
                subjectId: 'subject-world-history',
                termId: 'term-prelim',
                order: 1,
                createdAt: now,
                updatedAt: now,
            },
            // Uncategorized
            {
                id: 'spanish-verbs',
                title: 'Spanish Verb Conjugation',
                description: 'Present tense conjugations for regular -ar, -er, and -ir verbs.',
                sourceType: 'bundled',
                sourceId: 'spanish-verbs',
                createdAt: now,
                updatedAt: now,
            },
        ];

        // ── Legacy anatomy material (kept for backward compatibility) ──
        const legacyMaterial: StudyMaterial = {
            id: 'anatomy-physiology',
            title: 'Anatomy & Physiology: Body Membranes',
            description: 'Covering the integumentary system, skin structure, membranes, and common pathologies.',
            sourceType: 'bundled',
            sourceId: 'anatomy-physiology',
            createdAt: now,
            updatedAt: now,
        };

        const allMaterials = [...materials, legacyMaterial];

        // ── Questions for each material ────────────────────────
        const cellQuestions = this.buildCellStructureQuestions(now);
        const legacyQuestions = this.buildLegacySampleQuestions(now);
        const allQuestions = [...cellQuestions, ...legacyQuestions];

        // ── Quizzes ────────────────────────────────────────────
        const cellQuiz = this.buildQuiz('quiz-cell-001', 'cell-structure', 'Cell Structure Quiz', cellQuestions, now);
        const legacyQuiz = this.buildQuiz('quiz-anatomy-001', 'anatomy-physiology', 'Body Membranes — Practice Quiz', legacyQuestions, now);

        await this.database.transaction(
            'rw',
            [
                this.database.subjects,
                this.database.terms,
                this.database.subjectTerms,
                this.database.materials,
                this.database.questions,
                this.database.quizzes,
            ],
            async () => {
                await this.database.subjects.bulkPut([bioSubject, historySubject]);
                await this.database.terms.bulkPut(terms);
                await this.database.subjectTerms.bulkPut(subjectTerms);
                await this.database.materials.bulkPut(allMaterials);
                await this.database.questions.bulkPut(allQuestions);
                await this.database.quizzes.bulkPut([cellQuiz, legacyQuiz]);
            },
        );
    }

    private buildCellStructureQuestions(now: string): Question[] {
        return [
            {
                id: 'q-cell-mc-001',
                materialId: 'cell-structure',
                type: 'multiple_choice',
                prompt: 'Which organelle is responsible for producing ATP?',
                payload: {
                    type: 'multiple_choice',
                    choices: ['Ribosome', 'Mitochondria', 'Golgi apparatus', 'Endoplasmic reticulum'],
                    correctIndex: 1,
                },
                difficulty: 'easy',
                points: 1,
                explanation: 'Mitochondria are the powerhouse of the cell, generating ATP through cellular respiration.',
                tags: ['organelles', 'mitochondria'],
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-cell-tf-001',
                materialId: 'cell-structure',
                type: 'true_false',
                prompt: 'Prokaryotic cells have a membrane-bound nucleus.',
                payload: { type: 'true_false', correctAnswer: false },
                difficulty: 'easy',
                points: 1,
                explanation: 'Prokaryotic cells lack a membrane-bound nucleus; their DNA is in the nucleoid region.',
                tags: ['cell-types', 'prokaryotes'],
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
        ];
    }

    private buildLegacySampleQuestions(now: string): Question[] {
        return [
            {
                id: 'q-mc-001',
                materialId: 'anatomy-physiology',
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
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-ms-001',
                materialId: 'anatomy-physiology',
                type: 'multiple_select',
                prompt: 'Which of the following are functions of the integumentary system? (Select all that apply)',
                payload: {
                    type: 'multiple_select',
                    choices: ['Protection against pathogens', 'Vitamin D synthesis', 'Oxygen transport', 'Thermoregulation'],
                    correctIndices: [0, 1, 3],
                },
                difficulty: 'medium',
                points: 2,
                explanation: 'The integumentary system protects, synthesizes vitamin D, and regulates temperature. Oxygen transport is a cardiovascular function.',
                tags: ['integumentary', 'functions'],
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-tf-001',
                materialId: 'anatomy-physiology',
                type: 'true_false',
                prompt: 'The epidermis is the deepest layer of the skin.',
                payload: { type: 'true_false', correctAnswer: false },
                difficulty: 'easy',
                points: 1,
                explanation: 'The hypodermis (subcutaneous layer) is the deepest. The epidermis is the outermost layer.',
                tags: ['skin', 'layers'],
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-id-001',
                materialId: 'anatomy-physiology',
                type: 'identification',
                prompt: 'What is the protein that provides waterproofing to the outer layer of skin?',
                payload: { type: 'identification', correctAnswer: 'keratin', acceptedAlternatives: ['keratin protein'] },
                difficulty: 'medium',
                points: 2,
                explanation: 'Keratin is the fibrous protein that waterproofs and strengthens skin cells.',
                tags: ['proteins', 'skin'],
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
            {
                id: 'q-fb-001',
                materialId: 'anatomy-physiology',
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
                status: 'published',
                version: 1,
                createdAt: now,
                updatedAt: now,
            },
        ];
    }

    private buildQuiz(
        quizId: string,
        materialId: string,
        title: string,
        questions: Question[],
        now: string,
    ): Quiz {
        const items: QuizQuestion[] = questions.map((q, i) => ({
            quizId,
            questionId: q.id,
            questionVersion: q.version,
            order: i + 1,
            points: q.points,
        }));
        return {
            id: quizId,
            materialId,
            title,
            description: 'A mixed-format practice quiz for this material.',
            questionIds: questions.map((q) => q.id),
            items,
            status: 'published',
            passingPercentage: 70,
            createdAt: now,
            updatedAt: now,
        };
    }
}
