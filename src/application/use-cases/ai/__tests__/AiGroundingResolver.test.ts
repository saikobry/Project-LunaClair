import { describe, expect, it } from 'vitest';
import { AiGroundingResolver, AiGroundingUnavailableError } from '../AiGroundingResolver';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { AiGroundingMode, AiThread } from '../../../../domain/ai/models/ai.types';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const MATERIAL: StudyMaterial = {
  id: 'mat-1',
  title: 'Anatomy & Physiology',
  documentId: 'doc-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function materialThread(grounding: AiGroundingMode, materialId = MATERIAL.id): AiThread {
  return {
    id: 'thread-1',
    materialId,
    title: 'Pacemakers',
    grounding,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function createResolver(options: { material?: StudyMaterial | null; content?: string } = {}) {
  const material = options.material === undefined ? MATERIAL : options.material;
  const content = options.content ?? '# Cardiovascular System\nThe sinoatrial node is the pacemaker.';

  const chatRepo = new InMemoryAiChatRepository();
  const libraryRepo = {
    getMaterialById: async () => material,
  } as unknown as LibraryRepository;
  const documentRepo = {
    getDocumentByMaterial: async () => ({
      id: 'doc-1',
      title: MATERIAL.title,
      content,
      format: 'markdown' as const,
    }),
  } as unknown as DocumentRepository;

  return { resolver: new AiGroundingResolver(chatRepo, libraryRepo, documentRepo), chatRepo };
}

describe('AiGroundingResolver', () => {
  it('attaches the material document for a grounded thread', async () => {
    const { resolver, chatRepo } = createResolver();
    await chatRepo.saveThread(materialThread('whole'));

    const snapshot = await resolver.resolve({ threadId: 'thread-1' });

    expect(snapshot.mode).toBe('whole');
    expect(snapshot.materialId).toBe(MATERIAL.id);
    expect(snapshot.documentContext?.markdown).toContain('sinoatrial node');
    expect(snapshot.documentCharacters).toBe(snapshot.documentContext?.markdown.length);
  });

  it('attaches nothing for an ungrounded thread', async () => {
    const { resolver, chatRepo } = createResolver();
    await chatRepo.saveThread(materialThread('none'));

    const snapshot = await resolver.resolve({ threadId: 'thread-1' });

    expect(snapshot.mode).toBe('none');
    expect(snapshot.documentContext).toBeUndefined();
    expect(snapshot.documentCharacters).toBe(0);
  });

  it('never grounds a thread with no material, whatever the stored row says', async () => {
    const { resolver, chatRepo } = createResolver();
    await chatRepo.saveThread({
      ...materialThread('whole'),
      materialId: undefined,
    });

    const snapshot = await resolver.resolve({ threadId: 'thread-1' });

    expect(snapshot.mode).toBe('none');
    expect(snapshot.documentContext).toBeUndefined();
  });

  it('rejects a thread that no longer exists rather than reporting it as ungrounded', async () => {
    // `'none'` here would conflate "a valid ungrounded conversation" with "this row is gone", and
    // would let the send path persist turns under a parent that no longer exists.
    const { resolver } = createResolver();

    await expect(resolver.resolve({ threadId: 'missing' })).rejects.toMatchObject({
      code: 'THREAD_NOT_FOUND',
    });
  });

  it('counts the truncation marker, so the meter matches the payload', async () => {
    // A derived `min(rawLength, cap)` would report exactly the cap and undercount by the marker's
    // length — the meter being wrong precisely when the material is large enough to matter.
    const { resolver, chatRepo } = createResolver({ content: 'x'.repeat(100_000) });
    await chatRepo.saveThread(materialThread('whole'));

    const snapshot = await resolver.resolve({ threadId: 'thread-1' });

    expect(snapshot.documentCharacters).toBeGreaterThan(16_000);
    expect(snapshot.documentContext?.markdown).toContain('Remaining content omitted for brevity');
    expect(snapshot.documentCharacters).toBe(snapshot.documentContext?.markdown.length);
  });

  it('applies the served model document budget rather than the default one', async () => {
    const { resolver, chatRepo } = createResolver({ content: 'x'.repeat(500_000) });
    await chatRepo.saveThread(materialThread('whole'));

    const standard = await resolver.resolve({ threadId: 'thread-1' });
    const max = await resolver.resolve({ threadId: 'thread-1' }, { model: 'ukisai-swift-max' });

    expect(max.documentCharacters).toBeGreaterThan(standard.documentCharacters * 5);
  });

  it('fails loudly when a grounded thread has no readable material', async () => {
    const { resolver, chatRepo } = createResolver({ material: null });
    await chatRepo.saveThread(materialThread('whole'));

    await expect(resolver.resolve({ threadId: 'thread-1' })).rejects.toBeInstanceOf(
      AiGroundingUnavailableError,
    );
  });

  it('resolves a draft from its own material and grounding', async () => {
    const { resolver } = createResolver();

    const grounded = await resolver.resolve({ materialId: MATERIAL.id, grounding: 'whole' });
    const ungrounded = await resolver.resolve({ materialId: MATERIAL.id, grounding: 'none' });
    const global = await resolver.resolve({ materialId: undefined, grounding: 'none' });

    expect(grounded.mode).toBe('whole');
    expect(grounded.documentContext).toBeDefined();
    expect(ungrounded.documentContext).toBeUndefined();
    expect(global.mode).toBe('none');
  });
});
