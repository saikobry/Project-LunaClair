import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieDocumentContentRepository } from '../../../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { HybridDocumentRepository } from '../../../../infrastructure/storage/repositories/HybridDocumentRepository';
import { UpdateDocumentContentUseCase } from '../../../../application/use-cases/content/UpdateDocumentContentUseCase';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('Stage 4A — Production Dexie Persistence & Hybrid Resolution Integration', () => {
  const sampleMaterial: StudyMaterial = {
    id: 'mat-anatomy-1',
    documentId: 'doc-anatomy-1',
    title: 'Integumentary System',
    description: 'Anatomy and physiology notes',
    order: 1,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  let dexieRepo: DexieDocumentContentRepository;
  let hybridRepo: HybridDocumentRepository;
  let updateUseCase: UpdateDocumentContentUseCase;

  beforeEach(async () => {
    await db.documentContents.clear();
    dexieRepo = new DexieDocumentContentRepository();
    hybridRepo = new HybridDocumentRepository(dexieRepo);
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

  it('resolves local Dexie content in production HybridDocumentRepository', async () => {
    // 1. Before edit: returns empty document content fallback
    const initialDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(initialDoc.content).toBe('');
    expect(initialDoc.id).toBe(sampleMaterial.id);

    // 2. User edits and saves locally in Dexie
    const editedMarkdown = '# Edited Note\n\nLocal Dexie override content.';
    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: editedMarkdown,
    });

    // 3. HybridDocumentRepository resolves local Dexie content
    const readerDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(readerDoc.content).toBe(editedMarkdown);
    expect(readerDoc.id).toBe(sampleMaterial.id);
  });

  it('returns empty document fallback when local Dexie record is deleted or absent', async () => {
    // Save local content
    await updateUseCase.execute({
      documentId: sampleMaterial.documentId,
      title: sampleMaterial.title,
      content: '# Temporary Override',
    });
    expect((await hybridRepo.getDocumentByMaterial(sampleMaterial)).content).toBe('# Temporary Override');

    // Delete local record from Dexie
    await dexieRepo.deleteByDocumentId(sampleMaterial.documentId);

    // Resolves empty document fallback
    const restoredDoc = await hybridRepo.getDocumentByMaterial(sampleMaterial);
    expect(restoredDoc.content).toBe('');
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
