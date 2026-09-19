import { SendChatMessageUseCase } from '../../../application/use-cases/ai/SendChatMessageUseCase';
import { ResolveAiThreadUseCase } from '../../../application/use-cases/ai/ResolveAiThreadUseCase';
import { CreateAiThreadUseCase } from '../../../application/use-cases/ai/CreateAiThreadUseCase';
import { RenameAiThreadUseCase } from '../../../application/use-cases/ai/RenameAiThreadUseCase';
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
            resolveThread: new ResolveAiThreadUseCase(repositories.aiChat),
            createThread: new CreateAiThreadUseCase(repositories.aiChat),
            renameThread: new RenameAiThreadUseCase(repositories.aiChat),
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
