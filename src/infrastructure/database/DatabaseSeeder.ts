import type { LunaClairDatabase } from './LunaClairDatabase';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { SubjectTerm } from '../../domain/library/SubjectTerm';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz, QuizQuestion } from '../../domain/quiz/Quiz';
import { build50CellBiologyQuestions, build50QuestionQuizObj } from './seeds/build50QuestionQuiz';

/** Shape of the D1 catalog snapshot served by `GET /api/catalog`. */
interface CatalogSnapshot {
    subjects: Subject[];
    terms: Term[];
    subjectTerms: SubjectTerm[];
    materials: StudyMaterial[];
}

/**
 * Seeds the database with demo content if empty.
 * Hydrates the catalog (subjects, terms, subject-term links, materials) from the
 * D1 snapshot endpoint, then seeds sample questions for all 5 question types and
 * starter quizzes locally (quiz content still ships in the bundle this phase).
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

        // ── Catalog (subjects/terms/materials) — hydrated from the D1 snapshot ──
        // Seed-once semantics: fetch the canonical catalog from `/api/catalog` and
        // bulk-write it into Dexie. After the first successful hydration, Dexie owns
        // the local working copy and is never re-seeded from D1 (the guard above
        // returns when subjects already exist). If the fetch fails — e.g. a fresh
        // install with no network — skip seeding entirely; the library stays empty
        // and the next boot retries.
        const catalog = await this.fetchCatalog();
        if (!catalog) {
            console.warn('[DatabaseSeeder] Catalog hydration skipped — /api/catalog unavailable');
            return;
        }

        // ── Questions for each material ────────────────────────
        const master50Questions = build50CellBiologyQuestions(now);
        const cellQuestions = this.buildCellStructureQuestions(now);
        const legacyQuestions = this.buildLegacySampleQuestions(now);
        const allQuestions = [...master50Questions, ...cellQuestions, ...legacyQuestions];

        // ── Quizzes ────────────────────────────────────────────
        const master50Quiz = build50QuestionQuizObj(now);
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
                await this.database.subjects.bulkPut(catalog.subjects);
                await this.database.terms.bulkPut(catalog.terms);
                await this.database.subjectTerms.bulkPut(catalog.subjectTerms);
                await this.database.materials.bulkPut(catalog.materials);
                await this.database.questions.bulkPut(allQuestions);
                await this.database.quizzes.bulkPut([master50Quiz, cellQuiz, legacyQuiz]);
            },
        );
    }

    /**
     * Fetches the canonical catalog snapshot from the API Worker.
     * Returns null when the endpoint is unreachable or returns an error
     * (e.g. first-ever offline boot) — the caller skips seeding in that case.
     */
    private async fetchCatalog(): Promise<CatalogSnapshot | null> {
        try {
            const response = await fetch('/api/catalog', { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) return null;
            return (await response.json()) as CatalogSnapshot;
        } catch {
            return null;
        }
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
