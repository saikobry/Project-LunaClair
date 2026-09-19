import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { CreateAiThreadUseCase } from '../CreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../GetAiThreadMessagesUseCase';

describe('GetAiThreadMessagesUseCase', () => {
    let db: LunaClairDatabase;
    let chatRepo: DexieAiChatRepository;

    beforeEach(async () => {
        db = new LunaClairDatabase();
        await db.open();
        chatRepo = new DexieAiChatRepository(db);
    });

    afterEach(async () => {
        await db.delete();
        db.close();
    });

    it('retrieves chronological messages for a thread', async () => {
        const createThread = new CreateAiThreadUseCase(chatRepo);
        const getMessages = new GetAiThreadMessagesUseCase(chatRepo);

        const thread = await createThread.execute({ materialId: 'doc-1' });

        await chatRepo.saveMessage({
            id: 'm1',
            threadId: thread.id,
            role: 'user',
            content: 'Turn 1',
            status: 'complete',
            createdAt: '2026-08-25T01:00:00.000Z',
        });
        await chatRepo.saveMessage({
            id: 'm2',
            threadId: thread.id,
            role: 'assistant',
            content: 'Turn 2',
            status: 'complete',
            createdAt: '2026-08-25T01:01:00.000Z',
        });

        const messages = await getMessages.execute({ threadId: thread.id });
        expect(messages).toHaveLength(2);
        expect(messages[0].content).toBe('Turn 1');
        expect(messages[1].content).toBe('Turn 2');
    });
});
