import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../LunaClairDatabase';
import { DexieLibraryImportService } from '../DexieLibraryImportService';
import type { ImportMaterialInput } from '../../../../domain/library/services/LibraryImportService';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../../domain/library/models/Subject';
import type { Term } from '../../../../domain/library/models/Term';
import type { SubjectTerm } from '../../../../domain/library/models/SubjectTerm';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../../../domain/reader/repositories/DocumentContentRepository';

describe('DexieLibraryImportService', () => {
  let db: LunaClairDatabase;
  let service: DexieLibraryImportService;

  beforeEach(async () => {
    db = new LunaClairDatabase(`test-library-import-${Math.random().toString(36).slice(2)}`);
    await db.open();
    service = new DexieLibraryImportService(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  function createSampleInput(id = 'mat-1'): ImportMaterialInput {
    const now = '2026-08-01T00:00:00.000Z';
    const subject: Subject = {
      id: 'subj-1',
      title: 'Biology',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const term: Term = {
      id: 'term-1',
      title: 'Prelim',
      createdAt: now,
      updatedAt: now,
    };
    const subjectTerm: SubjectTerm = {
      subjectId: 'subj-1',
      termId: 'term-1',
      order: 1,
    };
    const material: StudyMaterial = {
      id,
      title: `Material ${id}`,
      documentId: `doc-${id}`,
      subjectId: 'subj-1',
      termId: 'term-1',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const question: Question = {
      id: `q-${id}`,
      materialId: id,
      type: 'true_false',
      prompt: 'Is biology science?',
      payload: { type: 'true_false', correctAnswer: true },
      difficulty: 'easy',
      points: 5,
      status: 'published',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const quiz: Quiz = {
      id: `quiz-${id}`,
      materialId: id,
      title: 'Quiz 1',
      items: [{ quizId: `quiz-${id}`, questionId: `q-${id}`, questionVersion: 1, order: 0 }],
      questionIds: [`q-${id}`],
      status: 'published',
      createdAt: now,
      updatedAt: now,
    };
    const documentContent: ImportedDocumentContent = {
      documentId: `doc-${id}`,
      title: `Material ${id}`,
      content: '# Biology Notes',
      updatedAt: now,
    };

    return {
      material,
      subject,
      term,
      subjectTerm,
      questions: [question],
      quizzes: [quiz],
      documentContent,
    };
  }

  it('atomically imports full material bundle across all 7 stores', async () => {
    const input = createSampleInput('mat-1');
    await service.importMaterial(input);

    expect(await db.materials.get('mat-1')).toBeDefined();
    expect(await db.subjects.get('subj-1')).toBeDefined();
    expect(await db.terms.get('term-1')).toBeDefined();
    expect(await db.subjectTerms.get(['subj-1', 'term-1'])).toBeDefined();
    expect(await db.questions.get('q-mat-1')).toBeDefined();
    expect(await db.quizzes.get('quiz-mat-1')).toBeDefined();
    expect(await db.documentContents.get('doc-mat-1')).toBeDefined();
  });

  it('removes imported material, questions, quizzes, and document content while leaving subjects and terms intact', async () => {
    const input = createSampleInput('mat-del');
    await service.importMaterial(input);

    await service.removeImportedMaterial('mat-del');

    // Material and associated learning content removed
    expect(await db.materials.get('mat-del')).toBeUndefined();
    expect(await db.questions.get('q-mat-del')).toBeUndefined();
    expect(await db.quizzes.get('quiz-mat-del')).toBeUndefined();
    expect(await db.documentContents.get('doc-mat-del')).toBeUndefined();

    // Subjects and terms remain intact for other materials
    expect(await db.subjects.get('subj-1')).toBeDefined();
    expect(await db.terms.get('term-1')).toBeDefined();
  });

  it('imports material batch and deduplicates shared subjects and terms', async () => {
    const input1 = createSampleInput('mat-batch-1');
    const input2 = createSampleInput('mat-batch-2');

    await service.importMaterialBatch([input1, input2]);

    expect(await db.materials.count()).toBe(2);
    // Subjects and terms are deduplicated
    expect(await db.subjects.count()).toBe(1);
    expect(await db.terms.count()).toBe(1);
    expect(await db.subjectTerms.count()).toBe(1);
    expect(await db.questions.count()).toBe(2);
    expect(await db.quizzes.count()).toBe(2);
    expect(await db.documentContents.count()).toBe(2);
  });

  it('rolls back entire transaction if document content write fails', async () => {
    const input = createSampleInput('mat-fail');

    // Intercept documentContents.put to fail after subject, term, material, etc. were staged
    vi.spyOn(db.documentContents, 'put').mockRejectedValueOnce(
      new Error('Simulated document content failure'),
    );

    await expect(service.importMaterial(input)).rejects.toThrow('Simulated document content failure');

    // Verify atomic rollback across all tables
    expect(await db.materials.count()).toBe(0);
    expect(await db.subjects.count()).toBe(0);
    expect(await db.terms.count()).toBe(0);
    expect(await db.subjectTerms.count()).toBe(0);
    expect(await db.questions.count()).toBe(0);
    expect(await db.quizzes.count()).toBe(0);
    expect(await db.documentContents.count()).toBe(0);
  });
});
