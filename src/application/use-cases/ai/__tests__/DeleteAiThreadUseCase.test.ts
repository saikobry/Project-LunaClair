import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { GetOrCreateAiThreadUseCase } from '../GetOrCreateAiThreadUseCase';
import { DeleteAiThreadUseCase } from '../DeleteAiThreadUseCase';

describe('DeleteAiThreadUseCase', () => {
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

    it('deletes specific thread while leaving other document threads intact', async () => {
        const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);
        const deleteThread = new DeleteAiThreadUseCase(chatRepo);

        const thread1 = await getOrCreate.execute({
            materialId: 'doc-1',
            mode: 'assistant',
        });
        await getOrCreate.execute({
            materialId: 'doc-2',
            mode: 'assistant',
        });

        await deleteThread.execute({ threadId: thread1.id });
        const remainingForDoc1 = await chatRepo.listThreads('doc-1');
        expect(remainingForDoc1).toHaveLength(0);

        const remainingForDoc2 = await chatRepo.listThreads('doc-2');
        expect(remainingForDoc2).toHaveLength(1);
    });
});
