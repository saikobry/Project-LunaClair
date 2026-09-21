import { describe, expect, it } from 'vitest';
import { GetAiGroundingContextUseCase } from '../GetAiGroundingContextUseCase';
import { AiGroundingResolver } from '../AiGroundingResolver';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';
import type { LibraryRepository } from '../../../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { AiGroundingMode, AiThread } from '../../../../domain/ai/models/ai.types';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const MATERIAL: StudyMaterial = {
  id: 'mat-1',
  title: 'Cardiology',
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

function createUseCase(content = '# Cardiovascular System\nThe sinoatrial node is the pacemaker.') {
  const chatRepo = new InMemoryAiChatRepository();
  const libraryRepo = {
    getMaterialById: async () => MATERIAL,
  } as unknown as LibraryRepository;
  const documentRepo = {
    getDocumentByMaterial: async () => ({
      id: 'doc-1',
      title: MATERIAL.title,
      content,
      format: 'markdown' as const,
    }),
  } as unknown as DocumentRepository;

  const resolver = new AiGroundingResolver(chatRepo, libraryRepo, documentRepo);
  return { useCase: new GetAiGroundingContextUseCase(resolver), chatRepo };
}

describe('GetAiGroundingContextUseCase', () => {
  it('returns mode and serialized documentCharacters for a grounded thread', async () => {
    const { useCase, chatRepo } = createUseCase();
    await chatRepo.saveThread(materialThread('whole'));

    const result = await useCase.execute({ threadId: 'thread-1' });
    expect(result.mode).toBe('whole');
    expect(result.documentCharacters).toBeGreaterThan(0);
  });

  it('returns mode none and 0 documentCharacters for an ungrounded thread', async () => {
    const { useCase, chatRepo } = createUseCase();
    await chatRepo.saveThread(materialThread('none'));

    const result = await useCase.execute({ threadId: 'thread-1' });
    expect(result.mode).toBe('none');
    expect(result.documentCharacters).toBe(0);
  });

  it('estimates from draftGrounding without a thread (draft session)', async () => {
    const { useCase } = createUseCase();

    const wholeResult = await useCase.execute({
      materialId: MATERIAL.id,
      grounding: 'whole',
    });
    expect(wholeResult.mode).toBe('whole');
    expect(wholeResult.documentCharacters).toBeGreaterThan(0);

    const noneResult = await useCase.execute({
      materialId: MATERIAL.id,
      grounding: 'none',
    });
    expect(noneResult.mode).toBe('none');
    expect(noneResult.documentCharacters).toBe(0);
  });

  it('respects per-model document cap options', async () => {
    const hugeContent = 'x'.repeat(200_000);
    const { useCase } = createUseCase(hugeContent);

    const standardResult = await useCase.execute(
      { materialId: MATERIAL.id, grounding: 'whole' },
      { model: 'cf-llama-3.3-70b' },
    );
    const maxResult = await useCase.execute(
      { materialId: MATERIAL.id, grounding: 'whole' },
      { model: 'ukisai-swift-max' },
    );

    expect(standardResult.documentCharacters).toBeLessThan(40_000);
    expect(maxResult.documentCharacters).toBeGreaterThan(standardResult.documentCharacters);
  });
});
