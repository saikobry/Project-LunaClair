import type { LunaClairDatabase } from './LunaClairDatabase';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { SubjectTerm } from '../../domain/library/SubjectTerm';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz } from '../../domain/quiz/Quiz';

/** Shape of the D1 catalog snapshot served by `GET /api/catalog`. */
interface CatalogSnapshot {
    subjects: Subject[];
    terms: Term[];
    subjectTerms: SubjectTerm[];
    materials: StudyMaterial[];
}

/** Shape of the D1 quiz snapshot served by `GET /api/quiz` (assembled). */
interface QuizSnapshot {
    questions: Question[];
    quizzes: Quiz[];
}

/**
 * Seeds the database with demo content if empty.
 *
 * Hydrates the catalog (subjects, terms, subject-term links, materials) and the
 * quiz content (questions, quizzes) from their D1 snapshot endpoints. Seed-once
 * semantics: after the first successful hydration, Dexie owns the local working
 * copy and is never re-seeded from D1 (the guard below returns when subjects
 * already exist). If the catalog fetch fails — e.g. a fresh install with no
 * network — seeding is skipped entirely and the next boot retries; a quiz fetch
 * failure skips only quiz content so the library can still hydrate.
 */
export class DatabaseSeeder {
    private readonly database: LunaClairDatabase;

    constructor(database: LunaClairDatabase) {
        this.database = database;
    }

    async seedIfEmpty(): Promise<void> {
        const subjectCount = await this.database.subjects.count();
        if (subjectCount > 0) return;

        // Fetch both snapshots independently so a quiz-endpoint failure cannot
        // block the library catalog from hydrating.
        const [catalog, quiz] = await Promise.all([this.fetchCatalog(), this.fetchQuiz()]);
        if (!catalog) {
            console.warn('[DatabaseSeeder] Catalog hydration skipped — /api/catalog unavailable');
            return;
        }
        if (!quiz) {
            console.warn('[DatabaseSeeder] Quiz hydration skipped — /api/quiz unavailable');
        }

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
                if (quiz) {
                    await this.database.questions.bulkPut(quiz.questions);
                    await this.database.quizzes.bulkPut(quiz.quizzes);
                }
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

    /**
     * Fetches the canonical quiz snapshot from the API Worker.
     * Returns null when the endpoint is unreachable or returns an error.
     */
    private async fetchQuiz(): Promise<QuizSnapshot | null> {
        try {
            const response = await fetch('/api/quiz', { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) return null;
            return (await response.json()) as QuizSnapshot;
        } catch {
            return null;
        }
    }
}
