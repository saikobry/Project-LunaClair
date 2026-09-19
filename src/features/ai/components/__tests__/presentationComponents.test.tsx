import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiStreamingIndicator } from '../AiStreamingIndicator';
import { AiChatErrorBanner } from '../AiChatErrorBanner';
import { AiChatInput } from '../AiChatInput';

describe('AI Presentation Components', () => {
  describe('AiStreamingIndicator', () => {
    it('renders accessible status role and default label', () => {
      render(<AiStreamingIndicator />);
      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveTextContent('AI is thinking…');
    });

    it('renders custom label when provided', () => {
      render(<AiStreamingIndicator label="Still working… 12s" />);
      expect(screen.getByText('Still working… 12s')).toBeInTheDocument();
    });
  });

  describe('AiChatErrorBanner', () => {
    it('surfaces the failure and offers retry and dismiss', () => {
      const onRetry = vi.fn();
      const onDismiss = vi.fn();

      render(
        <AiChatErrorBanner
          message="The assistant did not start responding in time. Please try again."
          onRetry={onRetry}
          onDismiss={onDismiss}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/did not start responding in time/i);

      fireEvent.click(screen.getByRole('button', { name: /Retry the request/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /Dismiss this error/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('AiChatInput', () => {
    const typeMessage = (box: HTMLElement, text: string) => {
      box.textContent = text;
      fireEvent.input(box);
    };

    it('sends message on click and clears input', () => {
      const onSend = vi.fn();

      render(<AiChatInput onSendMessage={onSend} />);
      const textbox = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });
      const sendButton = screen.getByRole('button', { name: 'Send' });

      expect(sendButton).toBeDisabled();

      typeMessage(textbox, 'Explain mitosis in detail');
      expect(sendButton).toBeEnabled();

      fireEvent.click(sendButton);
      expect(onSend).toHaveBeenCalledWith('Explain mitosis in detail');
      expect(textbox).toHaveTextContent('');
    });

    it('sends message on Enter key without shift', async () => {
      const onSend = vi.fn();
      render(<AiChatInput onSendMessage={onSend} />);
      const textbox = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });

      typeMessage(textbox, 'What is ATP?');
      fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: false });

      expect(onSend).toHaveBeenCalledWith('What is ATP?');
      expect(textbox).toHaveTextContent('');
    });

    it('does NOT send message on Shift+Enter (allows multi-line)', async () => {
      const onSend = vi.fn();
      render(<AiChatInput onSendMessage={onSend} />);
      const textbox = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });

      typeMessage(textbox, 'Line 1');
      fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('does NOT send message when IME is composing', () => {
      const onSend = vi.fn();
      render(<AiChatInput onSendMessage={onSend} />);
      const textbox = screen.getByRole('textbox', { name: /Ask the AI Study Assistant/i });

      typeMessage(textbox, 'nihon');
      fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: false, isComposing: true, keyCode: 229 });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('renders Stop button during streaming and invokes onStopGeneration', async () => {
      const onStop = vi.fn();
      render(<AiChatInput onSendMessage={vi.fn()} onStopGeneration={onStop} isStreaming={true} />);

      const stopButton = screen.getByRole('button', { name: 'Stop' });
      expect(stopButton).toBeInTheDocument();

      fireEvent.click(stopButton);
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('renders selection context banner and clears it when dismissed', () => {
      const onClear = vi.fn();
      render(
        <AiChatInput
          onSendMessage={vi.fn()}
          selectionExcerpt="The mitochondrion is the powerhouse..."
          onClearSelection={onClear}
        />,
      );

      expect(screen.getByText(/The mitochondrion is the powerhouse/i)).toBeInTheDocument();
      const clearBtn = screen.getByRole('button', { name: /Clear selected text context/i });
      fireEvent.click(clearBtn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });
});
