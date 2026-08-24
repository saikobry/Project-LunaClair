import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import 'fake-indexeddb/auto';
import { AiChatDrawer } from '../AiChatDrawer';
import { AiDrawerToggleButton } from '../AiDrawerToggleButton';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieAiChatRepository } from '../../../../infrastructure/database/repositories/DexieAiChatRepository';
import { MockAiAdapter } from '../../../../infrastructure/ai/MockAiAdapter';
import { SendChatMessageUseCase } from '../../../../application/use-cases/ai/SendChatMessageUseCase';
import { GetOrCreateAiThreadUseCase } from '../../../../application/use-cases/ai/GetOrCreateAiThreadUseCase';
import { GetAiThreadMessagesUseCase } from '../../../../application/use-cases/ai/GetAiThreadMessagesUseCase';
import { DeleteAiThreadUseCase } from '../../../../application/use-cases/ai/DeleteAiThreadUseCase';
import { ClearChatHistoryUseCase } from '../../../../application/use-cases/ai/ClearChatHistoryUseCase';
import type { UseCases } from '../../../../app/bootstrap/createUseCases';
import type { Repositories } from '../../../../app/bootstrap/createRepositories';

function createTestHarness(db: LunaClairDatabase, mockAi: MockAiAdapter) {
  const aiChatRepository = new DexieAiChatRepository(db);
  const sendChatMessage = new SendChatMessageUseCase(mockAi, aiChatRepository);
  const getOrCreateThread = new GetOrCreateAiThreadUseCase(aiChatRepository);
  const getThreadMessages = new GetAiThreadMessagesUseCase(aiChatRepository);
  const deleteThread = new DeleteAiThreadUseCase(aiChatRepository);
  const clearChatHistory = new ClearChatHistoryUseCase(aiChatRepository);

  const contextValue = {
    repositories: {
      aiChatRepository,
    } as unknown as Repositories,
    useCases: {
      ai: {
        sendChatMessage,
        getOrCreateThread,
        getThreadMessages,
        deleteThread,
        clearChatHistory,
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

describe('AI Chat Drawer & Workspace Integration', () => {
  let db: LunaClairDatabase;

  beforeEach(async () => {
    db = new LunaClairDatabase();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  describe('AiDrawerToggleButton', () => {
    it('renders closed button and invokes onToggle', () => {
      const onToggle = vi.fn();
      render(<AiDrawerToggleButton isOpen={false} onToggle={onToggle} />);

      const btn = screen.getByRole('button', { name: /Toggle AI Study Assistant/i });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(btn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('renders streaming indicator badge when isStreaming is true', () => {
      render(<AiDrawerToggleButton isOpen={true} onToggle={vi.fn()} isStreaming={true} />);
      expect(screen.getByLabelText(/AI is currently generating/i)).toBeInTheDocument();
    });

    it('renders unread badge when closed and hasUnread is true', () => {
      render(
        <AiDrawerToggleButton
          isOpen={false}
          onToggle={vi.fn()}
          isStreaming={false}
          hasUnread={true}
        />,
      );
      expect(screen.getByLabelText(/New unread AI response/i)).toBeInTheDocument();
    });
  });

  describe('AiChatDrawer', () => {
    it('renders drawer, sends message, streams tokens and renders completed turn', async () => {
      const mockAi = new MockAiAdapter({
        tokens: ['The heart ', 'pumps blood ', 'throughout the body.'],
      });
      const harness = createTestHarness(db, mockAi);
      const onClose = vi.fn();

      render(
        <AiChatDrawer
          isOpen={true}
          onClose={onClose}
          materialId="material-bio"
          documentContext="# Biology Notes\nThe circulatory system..."
        />,
        { wrapper: harness.wrapper },
      );

      // Wait for thread to finish initial load and textarea to be enabled
      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
        expect(textarea).not.toBeDisabled();
      });

      // Type and send a prompt
      const textarea = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
      fireEvent.change(textarea, { target: { value: 'What does the heart do?' } });
      const sendBtn = screen.getByRole('button', { name: /Send message/i });
      fireEvent.click(sendBtn);

      // Verify user message appeared immediately
      expect(screen.getByText('What does the heart do?')).toBeInTheDocument();

      // Wait for assistant tokens to stream and complete
      await waitFor(() => {
        expect(screen.getByText(/pumps blood/i)).toBeInTheDocument();
      });

      // Verify close button calls onClose
      const closeBtn = screen.getByRole('button', { name: /Close AI Assistant/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles contextual action on mount/selection (e.g. Explain action)', async () => {
      const mockAi = new MockAiAdapter({
        tokens: ['The SA node initiates the electrical impulse.'],
      });
      const harness = createTestHarness(db, mockAi);
      const onClearSelection = vi.fn();

      render(
        <AiChatDrawer
          isOpen={true}
          onClose={vi.fn()}
          materialId="material-bio"
          documentContext="# Cardiac Notes\n..."
          selectionContext={{
            text: 'The SA node initiates each cardiac cycle',
            action: 'explain',
          }}
          onClearSelectionContext={onClearSelection}
        />,
        { wrapper: harness.wrapper },
      );

      // Wait for automatic contextual prompt execution
      await waitFor(() => {
        expect(screen.getByText(/Please explain the following excerpt in clear detail/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/The SA node initiates the electrical impulse/i)).toBeInTheDocument();
      });

      expect(onClearSelection).toHaveBeenCalled();
    });
  });
});
