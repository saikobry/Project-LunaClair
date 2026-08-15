import type { LibraryImportService, ImportMaterialInput } from '../../../domain/library/LibraryImportService';
import { db } from '../LunaClairDatabase';

/**
 * Concrete `LibraryImportService` backed by Dexie.
 *
 * `importMaterial` writes the material's subject/term/subjectTerm rows, the
 * material row, its questions/quizzes, and its locally imported document
 * content inside a single `db.transaction('rw')` — atomic: either the whole
 * import lands or none of it does.
 *
 * `removeImportedMaterial` deletes the material row, its questions/quizzes,
 * and its document content in one transaction. Subject/term rows are left in
 * place (they may be shared with other imported materials).
 */
export class DexieLibraryImportService implements LibraryImportService {
    async importMaterial(input: ImportMaterialInput): Promise<void> {
        await db.transaction(
            'rw',
            [
                db.subjects,
                db.terms,
                db.subjectTerms,
                db.materials,
                db.questions,
                db.quizzes,
                db.documentContents,
            ],
            async () => {
                if (input.subject) await db.subjects.put(input.subject);
                if (input.term) await db.terms.put(input.term);
                if (input.subjectTerm) await db.subjectTerms.put(input.subjectTerm);
                await db.materials.put(input.material);
                if (input.questions.length > 0) await db.questions.bulkPut(input.questions);
                if (input.quizzes.length > 0) await db.quizzes.bulkPut(input.quizzes);
                if (input.documentContent) await db.documentContents.put(input.documentContent);
            },
        );
    }

    async removeImportedMaterial(materialId: string): Promise<void> {
        await db.transaction(
            'rw',
            [db.materials, db.questions, db.quizzes, db.documentContents],
            async () => {
                const material = await db.materials.get(materialId);
                await db.materials.delete(materialId);

                const questions = await db.questions.where('materialId').equals(materialId).toArray();
                if (questions.length > 0) await db.questions.bulkDelete(questions.map((q) => q.id));

                const quizzes = await db.quizzes.where('materialId').equals(materialId).toArray();
                if (quizzes.length > 0) await db.quizzes.bulkDelete(quizzes.map((z) => z.id));

                if (material?.documentId) await db.documentContents.delete(material.documentId);
            },
        );
    }
}

export const dexieLibraryImportService = new DexieLibraryImportService();
