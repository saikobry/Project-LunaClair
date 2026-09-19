import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieAiChatRepository } from '../DexieAiChatRepository';
import type { AiMessageRecord, AiThread } from '../../../../domain/ai/models/ai.types';

describe('DexieAiChatRepository & Schema v9', () => {
  let db: LunaClairDatabase;
  let repo: DexieAiChatRepository;

  beforeEach(async () => {
    db = new LunaClairDatabase();
    await db.open();
    repo = new DexieAiChatRepository(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('preserves existing v8 tables and provides aiThreads and aiMessages in schema v9/v10', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(9);
    expect(db.aiThreads).toBeDefined();
    expect(db.aiMessages).toBeDefined();
    expect(db.materials).toBeDefined();
    expect(db.documentContents).toBeDefined();
  });

  it('saves and retrieves AI threads with correct scoping', async () => {
    const threadOlder: AiThread = {
      id: 't-cardio-older',
      materialId: 'doc-cardio',
      title: 'Cardio Session One',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };

    const threadNewest: AiThread = {
      id: 't-cardio-newest',
      materialId: 'doc-cardio',
      title: 'Cardio Session Two',
      createdAt: '2026-08-25T01:10:00.000Z',
      updatedAt: '2026-08-25T01:10:00.000Z',
    };

    const threadGlobal: AiThread = {
      id: 't-global-assist',
      materialId: undefined,
      title: 'Global Tutor',
      createdAt: '2026-08-25T00:50:00.000Z',
      updatedAt: '2026-08-25T00:50:00.000Z',
    };

    await repo.saveThread(threadOlder);
    await repo.saveThread(threadNewest);
    await repo.saveThread(threadGlobal);

    // Verify listThreads with materialId filter
    const materialThreads = await repo.listThreads('doc-cardio');
    expect(materialThreads).toHaveLength(2);
    expect(materialThreads[0].id).toBe('t-cardio-newest'); // newest first

    // Verify listThreads for global threads
    const globalThreads = await repo.listThreads(undefined);
    expect(globalThreads).toHaveLength(1);
    expect(globalThreads[0].id).toBe('t-global-assist');

    // Every session of a material is its own conversation — the newest one is reopened.
    const latest = await repo.findLatestThread('doc-cardio');
    expect(latest?.id).toBe('t-cardio-newest');

    // A material with no sessions resolves to null instead of throwing.
    expect(await repo.findLatestThread('doc-absent')).toBeNull();

    const latestGlobal = await repo.findLatestThread(undefined);
    expect(latestGlobal?.id).toBe('t-global-assist');
  });

  it('saves message and updates parent thread updatedAt timestamp', async () => {
    const thread: AiThread = {
      id: 'thread-1',
      materialId: 'doc-1',
      title: 'Test Thread',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };
    await repo.saveThread(thread);

    const message: AiMessageRecord = {
      id: 'msg-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'Hello AI',
      status: 'complete',
      createdAt: '2026-08-25T01:05:00.000Z',
    };
    await repo.saveMessage(message);

    const messages = await repo.getMessages('thread-1');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello AI');

    const updatedThread = await repo.getThread('thread-1');
    expect(updatedThread?.updatedAt).toBe('2026-08-25T01:05:00.000Z');
  });

  it('returns one thread in createdAt order and does not leak another thread (v15 compound read)', async () => {
    await repo.saveThread({
      id: 'thread-order',
      materialId: 'doc-1',
      title: 'Order',
      createdAt: '2026-08-25T02:00:00.000Z',
      updatedAt: '2026-08-25T02:00:00.000Z',
    });

    // Inserted newest-first: the order must come from the `[threadId+createdAt]` index, not from
    // insertion order.
    await repo.saveMessage({
      id: 'm-late',
      threadId: 'thread-order',
      role: 'assistant',
      content: 'Second',
      status: 'complete',
      createdAt: '2026-08-25T02:02:00.000Z',
    });
    await repo.saveMessage({
      id: 'm-early',
      threadId: 'thread-order',
      role: 'user',
      content: 'First',
      status: 'complete',
      createdAt: '2026-08-25T02:01:00.000Z',
    });
    await repo.saveMessage({
      id: 'm-other-thread',
      threadId: 'thread-elsewhere',
      role: 'user',
      content: 'Other',
      status: 'complete',
      createdAt: '2026-08-25T02:00:30.000Z',
    });

    const messages = await repo.getMessages('thread-order');
    expect(messages.map((message) => message.id)).toEqual(['m-early', 'm-late']);
  });

  it('cascades deletion of messages when a thread is deleted', async () => {
    const thread: AiThread = {
      id: 'thread-delete',
      materialId: 'doc-1',
      title: 'To Delete',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };
    await repo.saveThread(thread);
    await repo.saveMessage({
      id: 'm1',
      threadId: 'thread-delete',
      role: 'user',
      content: 'Q1',
      status: 'complete',
      createdAt: '2026-08-25T01:01:00.000Z',
    });
    await repo.saveMessage({
      id: 'm2',
      threadId: 'thread-delete',
      role: 'assistant',
      content: 'A1',
      status: 'complete',
      createdAt: '2026-08-25T01:02:00.000Z',
    });

    await repo.deleteThread('thread-delete');

    const fetchedThread = await repo.getThread('thread-delete');
    expect(fetchedThread).toBeNull();

    const messages = await repo.getMessages('thread-delete');
    expect(messages).toHaveLength(0);
  });

  it('recovers orphaned streaming messages to error/INTERRUPTED status', async () => {
    const thread: AiThread = {
      id: 'thread-crash',
      materialId: 'doc-1',
      title: 'Crash Test',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };
    await repo.saveThread(thread);

    // Simulate an interrupted turn where browser reloaded during streaming
    await repo.saveMessage({
      id: 'msg-interrupted',
      threadId: 'thread-crash',
      role: 'assistant',
      content: 'Partially generated text...',
      status: 'streaming',
      createdAt: '2026-08-25T01:05:00.000Z',
    });

    const recoveredCount = await repo.recoverInterruptedMessages();
    expect(recoveredCount).toBe(1);

    const messages = await repo.getMessages('thread-crash');
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe('error');
    expect(messages[0].metadata?.errorCode).toBe('INTERRUPTED');
    expect(messages[0].metadata?.errorMessage).toBe('Generation was interrupted.');
  });
});
