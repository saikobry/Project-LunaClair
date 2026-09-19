import type { ReactNode } from 'react';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../app/providers/ApplicationContext';
import { DexieAiChatRepository } from '../../infrastructure/database/repositories/DexieAiChatRepository';
import type { LunaClairDatabase } from '../../infrastructure/database/schema/LunaClairDatabase';
import { SendChatMessageUseCase } from '../../application/use-cases/ai/SendChatMessageUseCase';
import { ResolveAiThreadUseCase } from '../../application/use-cases/ai/ResolveAiThreadUseCase';
import { CreateAiThreadUseCase } from '../../application/use-cases/ai/CreateAiThreadUseCase';
import { RenameAiThreadUseCase } from '../../application/use-cases/ai/RenameAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../application/use-cases/ai/ClearChatHistoryUseCase';
import type { UseCases } from '../../app/bootstrap/createUseCases';
import type { Infrastructure, Repositories } from '../../app/bootstrap/createInfrastructure';
import type { AiService } from '../../domain/ai/services/AiService';

/**
 * Wires the real Dexie AI chat repository and the real AI thread use cases over
 * a test database, substituting only the `AiService` port. Shared by the AI
 * drawer and chat-thread hook suites so both exercise the same graph.
 */
export function createAiChatHarness(db: LunaClairDatabase, aiService: AiService) {
  const aiChatRepository = new DexieAiChatRepository(db);

  const contextValue = {
    repositories: {
      aiChat: aiChatRepository,
    } as unknown as Repositories,
    infrastructure: {
      repositories: {
        aiChat: aiChatRepository,
      },
    } as unknown as Infrastructure,
    useCases: {
      ai: {
        sendChatMessage: new SendChatMessageUseCase(aiService, aiChatRepository),
        resolveThread: new ResolveAiThreadUseCase(aiChatRepository),
        createThread: new CreateAiThreadUseCase(aiChatRepository),
        renameThread: new RenameAiThreadUseCase(aiChatRepository),
        getThreadMessages: new GetAiThreadMessagesUseCase(aiChatRepository),
        deleteThread: new DeleteAiThreadUseCase(aiChatRepository),
        clearChatHistory: new ClearChatHistoryUseCase(aiChatRepository),
      },
    } as unknown as UseCases,
  } as unknown as ApplicationContextValue;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApplicationContext.Provider value={contextValue}>
      {children}
    </ApplicationContext.Provider>
  );

  return { contextValue, wrapper, aiChatRepository };
}
