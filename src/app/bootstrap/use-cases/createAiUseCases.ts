import { SendChatMessageUseCase } from '../../../application/use-cases/ai/SendChatMessageUseCase';
import { GetOrCreateAiThreadUseCase } from '../../../application/use-cases/ai/GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../../application/use-cases/ai/ClearChatHistoryUseCase';
import { GenerateQuestionsUseCase } from '../../../application/use-cases/generator/GenerateQuestionsUseCase';
import { BatchCreateQuestionsUseCase } from '../../../application/use-cases/generator/BatchCreateQuestionsUseCase';
import { GenerateFlashcardsUseCase } from '../../../application/use-cases/generator/GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../../../application/use-cases/generator/BatchCreateFlashcardsUseCase';
import type { Repositories } from '../createRepositories';

export function createAiUseCases(repositories: Repositories) {
    return {
        ai: {
            sendChatMessage: new SendChatMessageUseCase(repositories.aiService, repositories.aiChatRepository),
            getOrCreateThread: new GetOrCreateAiThreadUseCase(repositories.aiChatRepository),
            getThreadMessages: new GetAiThreadMessagesUseCase(repositories.aiChatRepository),
            deleteThread: new DeleteAiThreadUseCase(repositories.aiChatRepository),
            clearChatHistory: new ClearChatHistoryUseCase(repositories.aiChatRepository),
        },
        generator: {
            generateQuestions: new GenerateQuestionsUseCase(repositories.aiService),
            batchCreateQuestions: new BatchCreateQuestionsUseCase(repositories.questionRepository),
            generateFlashcards: new GenerateFlashcardsUseCase(repositories.aiService),
            batchCreateFlashcards: new BatchCreateFlashcardsUseCase(repositories.questionRepository),
        },
    };
}
