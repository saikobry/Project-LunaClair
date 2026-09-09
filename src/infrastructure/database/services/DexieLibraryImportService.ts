import type { LibraryImportService, ImportMaterialInput } from '../../../domain/library/services/LibraryImportService';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Concrete `LibraryImportService` backed by Dexie.
 *
 * `importMaterial` writes the material row, its questions/quizzes, and its
 * locally imported document content inside a single `db.transaction('rw')` —
 * atomic: either the whole import lands or none of it does.
 *
 * `importMaterialBatch` accepts multiple materials and commits everything in
 * one single atomic transaction.
 *
 * `removeImportedMaterial` deletes the material row, its questions/quizzes,
 * and its document content in one transaction.
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
                this.db.materials,
                this.db.questions,
                this.db.quizzes,
                this.db.documentContents,
            ],
            async () => {
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
                this.db.materials,
                this.db.questions,
                this.db.quizzes,
                this.db.documentContents,
            ],
            async () => {
                const materials: StudyMaterial[] = [];
                const questions: Question[] = [];
                const quizzes: Quiz[] = [];
                const documentContents: ImportedDocumentContent[] = [];

                for (const input of inputs) {
                    materials.push(input.material);
                    if (input.questions.length > 0) questions.push(...input.questions);
                    if (input.quizzes.length > 0) quizzes.push(...input.quizzes);
                    if (input.documentContent) documentContents.push(input.documentContent);
                }

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
