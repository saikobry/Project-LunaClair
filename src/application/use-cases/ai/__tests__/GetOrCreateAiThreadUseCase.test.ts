import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { GetOrCreateAiThreadUseCase } from '../GetOrCreateAiThreadUseCase';

describe('GetOrCreateAiThreadUseCase', () => {
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

    it('gets existing thread or creates new thread scoped by materialId + mode', async () => {
        const getOrCreate = new GetOrCreateAiThreadUseCase(chatRepo);

        const thread1 = await getOrCreate.execute({
            materialId: 'doc-cardio',
            mode: 'assistant',
        });

        expect(thread1.id).toBeDefined();
        expect(thread1.materialId).toBe('doc-cardio');
        expect(thread1.mode).toBe('assistant');

        // Calling again returns the exact same thread
        const thread1Again = await getOrCreate.execute({
            materialId: 'doc-cardio',
            mode: 'assistant',
        });
        expect(thread1Again.id).toBe(thread1.id);

        // Calling with a different mode creates a separate thread for that mode
        const threadSocratic = await getOrCreate.execute({
            materialId: 'doc-cardio',
            mode: 'socratic',
        });
        expect(threadSocratic.id).not.toBe(thread1.id);
        expect(threadSocratic.mode).toBe('socratic');
    });
});
