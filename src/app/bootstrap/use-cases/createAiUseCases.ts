import { SendChatMessageUseCase } from '../../../application/use-cases/ai/SendChatMessageUseCase';
import { ResolveAiThreadUseCase } from '../../../application/use-cases/ai/ResolveAiThreadUseCase';
import { CreateAiThreadUseCase } from '../../../application/use-cases/ai/CreateAiThreadUseCase';
import { RenameAiThreadUseCase } from '../../../application/use-cases/ai/RenameAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../../application/use-cases/ai/ClearChatHistoryUseCase';
import { GetAiModelCatalogUseCase } from '../../../application/use-cases/ai/GetAiModelCatalogUseCase';
import { AiGroundingResolver } from '../../../application/use-cases/ai/AiGroundingResolver';
import { GetAiGroundingContextUseCase } from '../../../application/use-cases/ai/GetAiGroundingContextUseCase';
import { SetThreadGroundingUseCase } from '../../../application/use-cases/ai/SetThreadGroundingUseCase';
import { SetGroundingDefaultUseCase } from '../../../application/use-cases/ai/SetGroundingDefaultUseCase';
import { SetSelectionThreadModeUseCase } from '../../../application/use-cases/ai/SetSelectionThreadModeUseCase';
import { SetPreferredModelIdUseCase } from '../../../application/use-cases/ai/SetPreferredModelIdUseCase';
import { GenerateQuestionsUseCase } from '../../../application/use-cases/generator/GenerateQuestionsUseCase';
import { BatchCreateQuestionsUseCase } from '../../../application/use-cases/generator/BatchCreateQuestionsUseCase';
import { GenerateFlashcardsUseCase } from '../../../application/use-cases/generator/GenerateFlashcardsUseCase';
import { BatchCreateFlashcardsUseCase } from '../../../application/use-cases/generator/BatchCreateFlashcardsUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createAiUseCases(infrastructure: Infrastructure) {
    const { repositories, services } = infrastructure;

    // One resolver instance behind both the payload and the meter: sharing the algorithm is what
    // keeps the meter describing the document the send path will actually attach.
    const aiGroundingResolver = new AiGroundingResolver(
        repositories.aiChat,
        repositories.library,
        repositories.document,
    );

    return {
        ai: {
            sendChatMessage: new SendChatMessageUseCase(services.ai, aiGroundingResolver, repositories.aiChat),
            getGroundingContext: new GetAiGroundingContextUseCase(aiGroundingResolver),
            setThreadGrounding: new SetThreadGroundingUseCase(repositories.aiChat),
            setGroundingDefault: new SetGroundingDefaultUseCase(repositories.preferences),
            setSelectionThreadMode: new SetSelectionThreadModeUseCase(repositories.preferences),
            setPreferredModelId: new SetPreferredModelIdUseCase(repositories.preferences),
            resolveThread: new ResolveAiThreadUseCase(repositories.aiChat),
            createThread: new CreateAiThreadUseCase(repositories.aiChat, repositories.preferences),
            renameThread: new RenameAiThreadUseCase(repositories.aiChat),
            getThreadMessages: new GetAiThreadMessagesUseCase(repositories.aiChat),
            deleteThread: new DeleteAiThreadUseCase(repositories.aiChat),
            clearChatHistory: new ClearChatHistoryUseCase(repositories.aiChat),
            getModelCatalog: new GetAiModelCatalogUseCase(repositories.aiModelCatalog),
        },
        generator: {
            generateQuestions: new GenerateQuestionsUseCase(services.ai),
            batchCreateQuestions: new BatchCreateQuestionsUseCase(repositories.question),
            generateFlashcards: new GenerateFlashcardsUseCase(services.ai),
            batchCreateFlashcards: new BatchCreateFlashcardsUseCase(repositories.question),
        },
    };
}
