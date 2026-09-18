import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiStreamingIndicator } from '../AiStreamingIndicator';
import { AiModeSelector } from '../AiModeSelector';
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
      render(<AiStreamingIndicator label="Generating socratic prompt…" />);
      expect(screen.getByText('Generating socratic prompt…')).toBeInTheDocument();
    });
  });

  describe('AiModeSelector', () => {
    it('renders tabs with active state and message counts', () => {
      const onModeChange = vi.fn();
      render(
        <AiModeSelector
          currentMode="assistant"
          onModeChange={onModeChange}
          assistantMessageCount={4}
          socraticMessageCount={2}
        />,
      );

      const assistantTab = screen.getByRole('tab', { name: /Study Assistant mode/i });
      const socraticTab = screen.getByRole('tab', { name: /Socratic Tutor mode/i });

      expect(assistantTab).toHaveAttribute('aria-selected', 'true');
      expect(socraticTab).toHaveAttribute('aria-selected', 'false');

      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();

      fireEvent.click(socraticTab);
      expect(onModeChange).toHaveBeenCalledWith('socratic');
    });

    it('disables mode switching when disabled prop is true', () => {
      const onModeChange = vi.fn();
      render(
        <AiModeSelector
          currentMode="assistant"
          onModeChange={onModeChange}
          disabled={true}
        />,
      );

      const socraticTab = screen.getByRole('tab', { name: /Socratic Tutor mode/i });
      expect(socraticTab).toBeDisabled();
      fireEvent.click(socraticTab);
      expect(onModeChange).not.toHaveBeenCalled();
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
