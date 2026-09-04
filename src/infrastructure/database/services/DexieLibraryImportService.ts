import type { LibraryImportService, ImportMaterialInput } from '../../../domain/library/services/LibraryImportService';
import type { Subject } from '../../../domain/library/models/Subject';
import type { Term } from '../../../domain/library/models/Term';
import type { SubjectTerm } from '../../../domain/library/models/SubjectTerm';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import { db as defaultDb, type LunaClairDatabase } from '../LunaClairDatabase';

/**
 * Concrete `LibraryImportService` backed by Dexie.
 *
 * `importMaterial` writes the material's subject/term/subjectTerm rows, the
 * material row, its questions/quizzes, and its locally imported document
 * content inside a single `db.transaction('rw')` — atomic: either the whole
 * import lands or none of it does.
 *
 * `importMaterialBatch` accepts multiple materials (e.g. an entire subject's
 * material collection), deduplicates referenced subject/term rows, and commits
 * everything in one single atomic transaction.
 *
 * `removeImportedMaterial` deletes the material row, its questions/quizzes,
 * and its document content in one transaction. Subject/term rows are left in
 * place (they may be shared with other imported materials).
 */
export class DexieLibraryImportService implements LibraryImportService {
    private readonly db: LunaClairDatabase;

    constructor(db: LunaClairDatabase = defaultDb) {
        this.db = db;
    }

    async importMaterial(input: ImportMaterialInput): Promise<void> {
        await this.db.transaction(
            'rw',
            [
                this.db.subjects,
                this.db.terms,
                this.db.subjectTerms,
                this.db.materials,
                this.db.questions,
                this.db.quizzes,
                this.db.documentContents,
            ],
            async () => {
                if (input.subject) await this.db.subjects.put(input.subject);
                if (input.term) await this.db.terms.put(input.term);
                if (input.subjectTerm) await this.db.subjectTerms.put(input.subjectTerm);
                await this.db.materials.put(input.material);
                if (input.questions.length > 0) await this.db.questions.bulkPut(input.questions);
                if (input.quizzes.length > 0) await this.db.quizzes.bulkPut(input.quizzes);
                if (input.documentContent) await this.db.documentContents.put(input.documentContent);
            },
        );
    }

    async importMaterialBatch(inputs: ImportMaterialInput[]): Promise<void> {
        if (inputs.length === 0) return;
        await this.db.transaction(
            'rw',
            [
                this.db.subjects,
                this.db.terms,
                this.db.subjectTerms,
                this.db.materials,
                this.db.questions,
                this.db.quizzes,
                this.db.documentContents,
            ],
            async () => {
                const subjectsMap = new Map<string, Subject>();
                const termsMap = new Map<string, Term>();
                const subjectTermsMap = new Map<string, SubjectTerm>();
                const materials: StudyMaterial[] = [];
                const questions: Question[] = [];
                const quizzes: Quiz[] = [];
                const documentContents: ImportedDocumentContent[] = [];

                for (const input of inputs) {
                    if (input.subject) subjectsMap.set(input.subject.id, input.subject);
                    if (input.term) termsMap.set(input.term.id, input.term);
                    if (input.subjectTerm) {
                        const key = `${input.subjectTerm.subjectId}+${input.subjectTerm.termId}`;
                        subjectTermsMap.set(key, input.subjectTerm);
                    }
                    materials.push(input.material);
                    if (input.questions.length > 0) questions.push(...input.questions);
                    if (input.quizzes.length > 0) quizzes.push(...input.quizzes);
                    if (input.documentContent) documentContents.push(input.documentContent);
                }

                if (subjectsMap.size > 0) await this.db.subjects.bulkPut(Array.from(subjectsMap.values()));
                if (termsMap.size > 0) await this.db.terms.bulkPut(Array.from(termsMap.values()));
                if (subjectTermsMap.size > 0) await this.db.subjectTerms.bulkPut(Array.from(subjectTermsMap.values()));
                if (materials.length > 0) await this.db.materials.bulkPut(materials);
                if (questions.length > 0) await this.db.questions.bulkPut(questions);
                if (quizzes.length > 0) await this.db.quizzes.bulkPut(quizzes);
                if (documentContents.length > 0) await this.db.documentContents.bulkPut(documentContents);
            },
        );
    }

    async removeImportedMaterial(materialId: string): Promise<void> {
        await this.db.transaction(
            'rw',
            [this.db.materials, this.db.questions, this.db.quizzes, this.db.documentContents],
            async () => {
                const material = await this.db.materials.get(materialId);
                await this.db.materials.delete(materialId);

                const questions = await this.db.questions.where('materialId').equals(materialId).toArray();
                if (questions.length > 0) await this.db.questions.bulkDelete(questions.map((q) => q.id));

                const quizzes = await this.db.quizzes.where('materialId').equals(materialId).toArray();
                if (quizzes.length > 0) await this.db.quizzes.bulkDelete(quizzes.map((z) => z.id));

                if (material?.documentId) await this.db.documentContents.delete(material.documentId);
            },
        );
    }
}

export const dexieLibraryImportService = new DexieLibraryImportService();
