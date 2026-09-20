import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { AiChatDrawer } from '../AiChatDrawer';
import { AiDrawerToggleButton } from '../AiDrawerToggleButton';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { MockAiAdapter } from '../../../../test/mocks/MockAiAdapter';
import { createAiChatHarness } from '../../../../test/mocks/aiChatHarness';

describe('AI Chat Drawer & Workspace Integration', () => {
  let db: LunaClairDatabase;

  beforeEach(async () => {
    // Cooldown deadlines are persisted; a test that starts one must not hand it to the next test.
    localStorage.clear();
    db = new LunaClairDatabase();
    await db.open();
  });

  afterEach(async () => {
    document.body.style.overflow = '';
    localStorage.clear();
    await db.delete();
    db.close();
  });

  describe('AiDrawerToggleButton', () => {
    it('renders closed button and invokes onToggle', () => {
      const onToggle = vi.fn();
      render(<AiDrawerToggleButton isOpen={false} onToggle={onToggle} />);

      const btn = screen.getByRole('button', { name: /AI Assistant/i });
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
      const harness = createAiChatHarness(db, mockAi);
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

      // Wait for thread history to finish loading: the empty state only
      // renders once isLoading is false. (The composer is contentEditable,
      // which has no native disabled state for toBeDisabled to observe.)
      await screen.findByText(/Ask anything about your study notes/i);
      const textarea = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
      expect(textarea).toHaveAttribute('contenteditable', 'true');

      // Type and send a prompt
      textarea.textContent = 'What does the heart do?';
      fireEvent.input(textarea);
      const sendBtn = screen.getByRole('button', { name: 'Send' });
      expect(sendBtn).toBeEnabled();
      fireEvent.click(sendBtn);

      // Verify user message appeared immediately. Sending persists through the
      // session-creation use case first, so the bubble is awaited rather than
      // assumed synchronous.
      const transcript = screen.getByRole('log');
      await waitFor(() => {
        expect(within(transcript).getByText('What does the heart do?')).toBeInTheDocument();
      });

      // Wait for assistant tokens to stream and complete
      await waitFor(() => {
        expect(screen.getByText(/pumps blood/i)).toBeInTheDocument();
      }, { timeout: 4000 });

      // Verify close button calls onClose
      const closeBtn = screen.getByRole('button', { name: /Close AI Assistant/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles contextual action on mount/selection (e.g. Explain action)', async () => {
      const mockAi = new MockAiAdapter({
        tokens: ['The SA node initiates the electrical impulse.'],
      });
      const harness = createAiChatHarness(db, mockAi);
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
      }, { timeout: 4000 });

      await waitFor(() => {
        expect(screen.getByText(/The SA node initiates the electrical impulse/i)).toBeInTheDocument();
      }, { timeout: 4000 });

      expect(onClearSelection).toHaveBeenCalled();
    });

    it('locks page scroll while open and releases it when closed', () => {
      const mockAi = new MockAiAdapter({ tokens: ['Answer.'] });
      const harness = createAiChatHarness(db, mockAi);

      const { rerender } = render(
        <AiChatDrawer isOpen={true} onClose={vi.fn()} materialId="material-bio" />,
        { wrapper: harness.wrapper },
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <AiChatDrawer isOpen={false} onClose={vi.fn()} materialId="material-bio" />,
      );

      expect(document.body.style.overflow).toBe('');
    });

    it('shows a stalled-aware wait label while the assistant has produced no text', async () => {
      const mockAi = new MockAiAdapter({
        tokens: ['Pacemaker.'],
        delayMs: 200,
      });
      const harness = createAiChatHarness(db, mockAi);

      render(
        <AiChatDrawer isOpen={true} onClose={vi.fn()} materialId="material-bio" />,
        { wrapper: harness.wrapper },
      );

      // The composer is disabled until session resolution settles.
      await screen.findByText(/Ask anything about your study notes/i);
      const textarea = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
      textarea.textContent = 'What keeps the heart beating?';
      fireEvent.input(textarea);
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      // The wait label belongs to the transcript, not just the composer.
      const transcript = screen.getByRole('log');
      const status = await within(transcript).findByRole('status', {}, { timeout: 3000 });
      expect(status.textContent).toMatch(/Thinking…|Cooking…|Digging through your material…|Weighing the details…/);

      await waitFor(() => {
        expect(screen.getByText(/Pacemaker\./)).toBeInTheDocument();
      }, { timeout: 4000 });
    });

    it('keeps the previous conversation in history when starting a new one', async () => {
      const mockAi = new MockAiAdapter({ tokens: ['Answer one.'] });
      const harness = createAiChatHarness(db, mockAi);

      render(
        <AiChatDrawer isOpen={true} onClose={vi.fn()} materialId="material-bio" />,
        { wrapper: harness.wrapper },
      );

      // The composer is disabled until session resolution settles.
      await screen.findByText(/Ask anything about your study notes/i);
      const textarea = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
      textarea.textContent = 'First question';
      fireEvent.input(textarea);
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      const transcript = screen.getByRole('log');
      await waitFor(() => {
        expect(within(transcript).getByText('Answer one.')).toBeInTheDocument();
      }, { timeout: 4000 });

      // The session is named from its first prompt, so history is identifiable.
      fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }));
      const panel = await screen.findByRole('region', { name: /Conversation history/i });
      expect(await within(panel).findByText('First question')).toBeInTheDocument();

      // Starting a new chat clears the transcript without deleting the old session.
      fireEvent.click(screen.getByRole('button', { name: 'Start a new conversation' }));
      expect(await screen.findByText(/Ask anything about your study notes/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Conversation history' }));
      const reopenedPanel = await screen.findByRole('region', { name: /Conversation history/i });
      expect(await within(reopenedPanel).findByText('First question')).toBeInTheDocument();
    });
  });
});
