import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../app/providers/ApplicationContext';
import { DexieAiChatRepository } from '../../infrastructure/database/repositories/DexieAiChatRepository';
import type { LunaClairDatabase } from '../../infrastructure/database/schema/LunaClairDatabase';
import { SendChatMessageUseCase } from '../../application/use-cases/ai/SendChatMessageUseCase';
import { AiGroundingResolver } from '../../application/use-cases/ai/AiGroundingResolver';
import { ResolveAiThreadUseCase } from '../../application/use-cases/ai/ResolveAiThreadUseCase';
import { CreateAiThreadUseCase } from '../../application/use-cases/ai/CreateAiThreadUseCase';
import { RenameAiThreadUseCase } from '../../application/use-cases/ai/RenameAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../application/use-cases/ai/ClearChatHistoryUseCase';
import { GetAiGroundingContextUseCase } from '../../application/use-cases/ai/GetAiGroundingContextUseCase';
import { SetThreadGroundingUseCase } from '../../application/use-cases/ai/SetThreadGroundingUseCase';
import { SetGroundingDefaultUseCase } from '../../application/use-cases/ai/SetGroundingDefaultUseCase';
import { SetSelectionThreadModeUseCase } from '../../application/use-cases/ai/SetSelectionThreadModeUseCase';
import { InMemoryPreferencesRepository } from './inMemoryPreferencesRepository';
import type { UseCases } from '../../app/bootstrap/createUseCases';
import type { Infrastructure, Repositories } from '../../app/bootstrap/createInfrastructure';
import type { AiService } from '../../domain/ai/services/AiService';
import type { LibraryRepository } from '../../domain/library/repositories/LibraryRepository';
import type { DocumentRepository } from '../../domain/reader/repositories/DocumentRepository';

/**
 * Wires the real Dexie AI chat repository and the real AI thread use cases over
 * a test database, substituting only the `AiService` port. Shared by the AI
 * drawer and chat-thread hook suites so both exercise the same graph.
 */
export function createAiChatHarness(db: LunaClairDatabase, aiService: AiService) {
  const aiChatRepository = new DexieAiChatRepository(db);

  // Grounding resolves through the real resolver, so a harness thread exercises the same
  // thread -> material -> document path production uses. The material and document ports are stubs:
  // the harness is about the AI graph, not the library, so any requested material resolves to one
  // fixed document. A genuinely missing material is covered by the resolver's own suite.
  const material = {
    id: 'doc-cardio',
    title: 'Cardiology',
    documentId: 'document-doc-cardio',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const groundingResolver = new AiGroundingResolver(
    aiChatRepository,
    {
      getMaterialById: async (id: string) => ({ ...material, id }),
    } as unknown as LibraryRepository,
    {
      getDocumentByMaterial: async () => ({
        id: material.documentId,
        title: material.title,
        content: '# Cardiology\nThe sinoatrial node is the pacemaker.',
        format: 'markdown' as const,
      }),
    } as unknown as DocumentRepository,
  );

  const preferencesRepository = new InMemoryPreferencesRepository();

  const contextValue = {
    repositories: {
      aiChat: aiChatRepository,
      preferences: preferencesRepository,
    } as unknown as Repositories,
    infrastructure: {
      repositories: {
        aiChat: aiChatRepository,
        preferences: preferencesRepository,
      },
    } as unknown as Infrastructure,
    useCases: {
      ai: {
        sendChatMessage: new SendChatMessageUseCase(aiService, groundingResolver, aiChatRepository),
        getGroundingContext: new GetAiGroundingContextUseCase(groundingResolver),
        setThreadGrounding: new SetThreadGroundingUseCase(aiChatRepository),
        setGroundingDefault: new SetGroundingDefaultUseCase(preferencesRepository),
        setSelectionThreadMode: new SetSelectionThreadModeUseCase(preferencesRepository),
        resolveThread: new ResolveAiThreadUseCase(aiChatRepository),
        createThread: new CreateAiThreadUseCase(aiChatRepository, preferencesRepository),
        renameThread: new RenameAiThreadUseCase(aiChatRepository),
        getThreadMessages: new GetAiThreadMessagesUseCase(aiChatRepository),
        deleteThread: new DeleteAiThreadUseCase(aiChatRepository),
        clearChatHistory: new ClearChatHistoryUseCase(aiChatRepository),
      },
    } as unknown as UseCases,
  } as unknown as ApplicationContextValue;

  // The real app mounts one QueryClient at the root, and AI hooks read shared cache state through
  // it (the model catalog), so the harness must provide one too — per harness, so cached data from
  // one test never leaks into the next.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApplicationContext.Provider value={contextValue}>{children}</ApplicationContext.Provider>
    </QueryClientProvider>
  );

  return { contextValue, wrapper, aiChatRepository, queryClient };
}
