import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { GetOrCreateAiThreadUseCase } from '../GetOrCreateAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../ClearChatHistoryUseCase';

describe('ClearChatHistoryUseCase', () => {
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

    it('clears all threads and messages for a material', async () => {
        const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);
        const clearHistory = new ClearChatHistoryUseCase(chatRepo);

        await getOrCreate.execute({
            materialId: 'doc-bio',
            mode: 'assistant',
        });
        await getOrCreate.execute({
            materialId: 'doc-bio',
            mode: 'socratic',
        });

        expect(await chatRepo.listThreads('doc-bio')).toHaveLength(2);

        await clearHistory.execute({ materialId: 'doc-bio' });

        expect(await chatRepo.listThreads('doc-bio')).toHaveLength(0);
    });
});
