import { SendChatMessageUseCase } from '../../../application/use-cases/ai/SendChatMessageUseCase';
import { GetOrCreateAiThreadUseCase } from '../../../application/use-cases/ai/GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../../application/use-cases/ai/ClearChatHistoryUseCase';
import { GenerateQuestionsUseCase } from '../../../application/use-cases/generator/GenerateQuestionsUseCase';
import { BatchCreateQuestionsUseCase } from '../../../application/use-cases/generator/BatchCreateQuestionsUseCase';
import { GenerateFlashcardsUseCase } from '../../../application/use-cases/generator/GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../../../application/use-cases/generator/BatchCreateFlashcardsUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createAiUseCases(infrastructure: Infrastructure) {
    const { repositories, services } = infrastructure;

    return {
        ai: {
            sendChatMessage: new SendChatMessageUseCase(services.ai, repositories.aiChat),
            getOrCreateThread: new GetOrCreateAiThreadUseCase(repositories.aiChat),
            getThreadMessages: new GetAiThreadMessagesUseCase(repositories.aiChat),
            deleteThread: new DeleteAiThreadUseCase(repositories.aiChat),
            clearChatHistory: new ClearChatHistoryUseCase(repositories.aiChat),
        },
        generator: {
            generateQuestions: new GenerateQuestionsUseCase(services.ai),
            batchCreateQuestions: new BatchCreateQuestionsUseCase(repositories.question),
            generateFlashcards: new GenerateFlashcardsUseCase(services.ai),
            batchCreateFlashcards: new BatchCreateFlashcardsUseCase(repositories.question),
        },
    };
}
