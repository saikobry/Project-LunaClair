import { describe, expect, it } from 'vitest';
import {
  SetThreadGroundingUseCase,
  GroundingNotAvailableError,
} from '../SetThreadGroundingUseCase';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';
import type { AiThread } from '../../../../domain/ai/models/ai.types';

function makeThread(id: string, materialId?: string, grounding: 'whole' | 'none' = 'whole'): AiThread {
  return {
    id,
    materialId,
    title: 'Thread title',
    grounding,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('SetThreadGroundingUseCase', () => {
  it('updates grounding for an existing material-scoped thread', async () => {
    const chatRepo = new InMemoryAiChatRepository();
    await chatRepo.saveThread(makeThread('th-1', 'mat-1', 'whole'));

    const useCase = new SetThreadGroundingUseCase(chatRepo);
    await useCase.execute({ threadId: 'th-1', grounding: 'none' });

    const updated = await chatRepo.getThread('th-1');
    expect(updated?.grounding).toBe('none');
  });

  it('rejects setting whole grounding on a global thread', async () => {
    const chatRepo = new InMemoryAiChatRepository();
    await chatRepo.saveThread(makeThread('th-global', undefined, 'none'));

    const useCase = new SetThreadGroundingUseCase(chatRepo);
    await expect(
      useCase.execute({ threadId: 'th-global', grounding: 'whole' }),
    ).rejects.toThrow(GroundingNotAvailableError);

    const thread = await chatRepo.getThread('th-global');
    expect(thread?.grounding).toBe('none');
  });

  it('allows setting none on a global thread', async () => {
    const chatRepo = new InMemoryAiChatRepository();
    await chatRepo.saveThread(makeThread('th-global', undefined, 'none'));

    const useCase = new SetThreadGroundingUseCase(chatRepo);
    await useCase.execute({ threadId: 'th-global', grounding: 'none' });

    const thread = await chatRepo.getThread('th-global');
    expect(thread?.grounding).toBe('none');
  });

  it('safely ignores a non-existent thread', async () => {
    const chatRepo = new InMemoryAiChatRepository();
    const useCase = new SetThreadGroundingUseCase(chatRepo);

    await expect(
      useCase.execute({ threadId: 'missing', grounding: 'none' }),
    ).resolves.toBeUndefined();
  });
});
