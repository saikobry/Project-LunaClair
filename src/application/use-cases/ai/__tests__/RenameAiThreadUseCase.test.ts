import { describe, it, expect, beforeEach } from 'vitest';
import { RenameAiThreadUseCase } from '../RenameAiThreadUseCase';
import { InMemoryAiChatRepository } from './inMemoryAiChatRepository';
import type { AiThread } from '../../../../domain/ai/models/ai.types';

const THREAD: AiThread = {
  id: 'thread-1',
  materialId: 'doc-cardio',
  title: 'New chat',
  grounding: 'whole',
  createdAt: '2026-08-25T01:00:00.000Z',
  updatedAt: '2026-08-25T01:00:00.000Z',
};

describe('RenameAiThreadUseCase', () => {
  let chatRepo: InMemoryAiChatRepository;
  let renameThread: RenameAiThreadUseCase;

  beforeEach(async () => {
    chatRepo = new InMemoryAiChatRepository();
    renameThread = new RenameAiThreadUseCase(chatRepo);
    await chatRepo.saveThread(THREAD);
  });

  it('renames a session and trims the title', async () => {
    const renamed = await renameThread.execute({ threadId: 'thread-1', title: '  Cardiac cycle  ' });

    expect(renamed?.title).toBe('Cardiac cycle');
    expect((await chatRepo.getThread('thread-1'))?.title).toBe('Cardiac cycle');
  });

  it('keeps updatedAt untouched so history order tracks conversation activity', async () => {
    const renamed = await renameThread.execute({ threadId: 'thread-1', title: 'Cardiac cycle' });
    expect(renamed?.updatedAt).toBe(THREAD.updatedAt);
  });

  it('does not revert a grounding toggle made after the thread was read', async () => {
    // The stale-object hazard: a whole-object save would write back the grounding value read before
    // the toggle. The title-only partial update leaves both fields correct.
    await chatRepo.setGrounding('thread-1', 'none');

    await renameThread.execute({ threadId: 'thread-1', title: 'Cardiac cycle' });

    const thread = await chatRepo.getThread('thread-1');
    expect(thread?.title).toBe('Cardiac cycle');
    expect(thread?.grounding).toBe('none');
  });

  it('returns null for a missing thread or a blank title', async () => {
    expect(await renameThread.execute({ threadId: 'thread-absent', title: 'Nope' })).toBeNull();
    expect(await renameThread.execute({ threadId: 'thread-1', title: '   ' })).toBeNull();
    expect((await chatRepo.getThread('thread-1'))?.title).toBe('New chat');
  });
});
