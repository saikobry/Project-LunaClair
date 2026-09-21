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
      grounding: 'whole',
      createdAt: '2026-08-25T01:00:00.000Z',
      updatedAt: '2026-08-25T01:00:00.000Z',
    };

    const threadNewest: AiThread = {
      id: 't-cardio-newest',
      materialId: 'doc-cardio',
      title: 'Cardio Session Two',
      grounding: 'whole',
      createdAt: '2026-08-25T01:10:00.000Z',
      updatedAt: '2026-08-25T01:10:00.000Z',
    };

    const threadGlobal: AiThread = {
      id: 't-global-assist',
      materialId: undefined,
      title: 'Global Tutor',
      grounding: 'none',
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
      grounding: 'whole',
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
      grounding: 'whole',
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
      grounding: 'whole',
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
      grounding: 'whole',
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

  describe('grounding normalization', () => {
    /**
     * Writes a row straight to the table, bypassing the domain type, to reproduce a row persisted
     * before `grounding` existed or one carrying a value no runtime guard would accept.
     */
    async function writeRawRow(row: Record<string, unknown>): Promise<void> {
      await db.aiThreads.put(row as never);
    }

    it('normalizes a material-scoped row written before grounding existed to whole', async () => {
      await writeRawRow({
        id: 'legacy',
        materialId: 'doc-1',
        title: 'Legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const thread = await repo.getThread('legacy');

      expect(thread?.grounding).toBe('whole');
    });

    it('normalizes a malformed stored mode to whole rather than trusting it', async () => {
      await writeRawRow({
        id: 'corrupt',
        materialId: 'doc-1',
        title: 'Corrupt',
        grounding: 'sometimes',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const thread = await repo.getThread('corrupt');

      expect(thread?.grounding).toBe('whole');
    });

    it('coerces a global row storing whole to none, whatever is on disk', async () => {
      await writeRawRow({
        id: 'global',
        title: 'Global',
        grounding: 'whole',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      expect((await repo.getThread('global'))?.grounding).toBe('none');
      expect((await repo.listThreads())[0]?.grounding).toBe('none');
      expect((await repo.findLatestThread())?.grounding).toBe('none');
    });

    it('normalizes identically across every read path', async () => {
      await writeRawRow({
        id: 'legacy',
        materialId: 'doc-1',
        title: 'Legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      const viaGet = await repo.getThread('legacy');
      const viaList = (await repo.listThreads('doc-1'))[0];
      const viaLatest = await repo.findLatestThread('doc-1');

      expect(viaGet?.grounding).toBe('whole');
      expect(viaList?.grounding).toBe('whole');
      expect(viaLatest?.grounding).toBe('whole');
    });

    it('round-trips both valid modes without rewriting the stored row', async () => {
      await repo.saveThread({
        id: 'material',
        materialId: 'doc-1',
        title: 'Material',
        grounding: 'none',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      expect((await repo.getThread('material'))?.grounding).toBe('none');

      // Side-effect free: a read must not rewrite the row into the normalized shape.
      const stored = await db.aiThreads.get('material');
      expect(stored?.grounding).toBe('none');
    });

    it('renames through a partial write, preserving grounding and recency', async () => {
      await repo.saveThread({
        id: 'rename',
        materialId: 'doc-1',
        title: 'Old title',
        grounding: 'whole',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await repo.setGrounding('rename', 'none');
      await repo.setTitle('rename', 'New title');

      const thread = await repo.getThread('rename');
      expect(thread?.title).toBe('New title');
      // The toggle survives the rename: a whole-object save of a stale read would have reverted it.
      expect(thread?.grounding).toBe('none');
      expect(thread?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('updates only the grounding field and leaves updatedAt alone', async () => {
      await repo.saveThread({
        id: 'toggle',
        materialId: 'doc-1',
        title: 'Toggle',
        grounding: 'whole',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });

      await repo.setGrounding('toggle', 'none');

      const thread = await repo.getThread('toggle');
      expect(thread?.grounding).toBe('none');
      expect(thread?.title).toBe('Toggle');
      expect(thread?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('saveMessagePair', () => {
    beforeEach(async () => {
      await repo.saveThread({
        id: 'pair',
        materialId: 'doc-1',
        title: 'Pair',
        grounding: 'whole',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('persists both turns and bumps the thread to the later timestamp', async () => {
      await repo.saveMessagePair(
        {
          id: 'user-1',
          threadId: 'pair',
          role: 'user',
          content: 'Why?',
          status: 'complete',
          createdAt: '2026-01-01T00:10:00.000Z',
        },
        {
          id: 'assistant-1',
          threadId: 'pair',
          role: 'assistant',
          content: '',
          status: 'streaming',
          createdAt: '2026-01-01T00:10:01.000Z',
        },
      );

      const messages = await repo.getMessages('pair');
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].status).toBe('streaming');

      expect((await repo.getThread('pair'))?.updatedAt).toBe('2026-01-01T00:10:01.000Z');
    });

    it('rejects a pair whose parent thread no longer exists, leaving nothing orphaned', async () => {
      // The parent is verified inside the transaction, so a thread deleted between the resolver's
      // read and this write rolls the pair back instead of orphaning history nothing can reach.
      await expect(
        repo.saveMessagePair(
          {
            id: 'user-orphan',
            threadId: 'deleted-thread',
            role: 'user',
            content: 'Retry',
            status: 'complete',
            createdAt: '2026-01-01T00:10:00.000Z',
          },
          {
            id: 'assistant-orphan',
            threadId: 'deleted-thread',
            role: 'assistant',
            content: '',
            status: 'streaming',
            createdAt: '2026-01-01T00:10:01.000Z',
          },
        ),
      ).rejects.toThrow(/missing thread/);

      expect(await db.aiMessages.where('threadId').equals('deleted-thread').toArray()).toEqual([]);
    });
  });
});
