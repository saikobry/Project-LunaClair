import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieDocumentContentRepository } from '../../../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { HybridDocumentRepository } from '../../../../infrastructure/api/HybridDocumentRepository';
import { UpdateDocumentContentUseCase } from '../../../../application/use-cases/content/UpdateDocumentContentUseCase';
import type { StudyMaterial } from '../../../../domain/library/StudyMaterial';
import type { Document } from '../../../../domain/reader/Document';
import type { DocumentRepository } from '../../../../domain/reader/DocumentRepository';
import { DocumentNotFoundError } from '../../../../domain/reader/DocumentNotFoundError';

class MockRemoteDocumentRepository implements DocumentRepository {
  private remoteDocs = new Map<string, Document>();

  setDocument(materialId: string, doc: Document) {
    this.remoteDocs.set(materialId, doc);
  }

  async getDocumentByMaterial(material: StudyMaterial): Promise<Document> {
    const doc = this.remoteDocs.get(material.id);
    if (!doc) {
      throw new DocumentNotFoundError(material.documentId);
    }
    return doc;
  }
}

describe('Stage 4A — Production Dexie Persistence & Hybrid Resolution Integration', () => {
  const sampleMaterial: StudyMaterial = {
    id: 'mat-anatomy-1',
    documentId: 'doc-anatomy-1',
    title: 'Integumentary System',
    description: 'Anatomy and physiology notes',
    subjectId: 'sub-bio',
    termId: 'term-prelim',
    order: 1,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const canonicalDocument: Document = {
    id: 'mat-anatomy-1',
    title: 'Integumentary System',
    content: '# Canonical Integumentary System\n\nOriginal remote content.',
    format: 'markdown',
  };

  let dexieRepo: DexieDocumentContentRepository;
  let remoteRepo: MockRemoteDocumentRepository;
  let hybridRepo: HybridDocumentRepository;
  let updateUseCase: UpdateDocumentContentUseCase;

  beforeEach(async () => {
    await db.documentContents.clear();
    dexieRepo = new DexieDocumentContentRepository();
    remoteRepo = new MockRemoteDocumentRepository();
    remoteRepo.setDocument(sampleMaterial.id, canonicalDocument);
    hybridRepo = new HybridDocumentRepository(dexieRepo, remoteRepo);
    updateUseCase = new UpdateDocumentContentUseCase(dexieRepo);
  });

  it('saves local content through UpdateDocumentContentUseCase into real Dexie documentContents table', async () => {
    const updatedContent = '# Edited Integumentary System\n\nUser updated notes in Dexie.';
    const result = await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: updatedContent,
    });

    expect(result.documentId).toBe(sampleMaterial.documentId);
    expect(result.content).toBe(updatedContent);

    // Verify row directly in Dexie table
    const stored = await db.documentContents.get(sampleMaterial.documentId);
    expect(stored).toBeDefined();
    expect(stored?.documentId).toBe(sampleMaterial.documentId);
    expect(stored?.content).toBe(updatedContent);
    expect(stored?.title).toBe(sampleMaterial.title);
  });

  it('resolves local Dexie content in production HybridDocumentRepository, overriding canonical remote content', async () => {
    // 1. Before edit: returns canonical remote content
    const initialDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(initialDoc.content).toBe(canonicalDocument.content);

    // 2. User edits and saves locally in Dexie
    const editedMarkdown = '# Edited Note\n\nLocal Dexie override content.';
    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: editedMarkdown,
    });

    // 3. HybridDocumentRepository resolves local Dexie content first
    const readerDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(readerDoc.content).toBe(editedMarkdown);
    expect(readerDoc.id).toBe(sampleMaterial.id);
  });

  it('guarantees canonical remote content remains untouched when local Dexie override exists', async () => {
    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: '# Divergent Local Version',
    });

    // Direct fetch from remote source remains pristine
    const remoteDirect = await remoteRepo.getDocumentByMaterial(sampleMaterial);
    expect(remoteDirect.content).toBe(canonicalDocument.content);
  });

  it('falls back to remote repository when local Dexie record is deleted or absent', async () => {
    // Save local override
    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: '# Temporary Override',
    });
    expect((await hybridRepo.getDocumentByMaterial(sampleMaterial)).content).toBe('# Temporary Override');

    // Delete local record from Dexie
    await dexieRepo.deleteByDocumentId(sampleMaterial.documentId);

    // Resolves remote canonical content again
    const restoredDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(restoredDoc.content).toBe(canonicalDocument.content);
  });

  it('executes local Dexie save without requiring network connectivity', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: '# Offline Saved Content in Dexie',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const stored = await db.documentContents.get(sampleMaterial.documentId);
    expect(stored?.content).toBe('# Offline Saved Content in Dexie');
  });
});
