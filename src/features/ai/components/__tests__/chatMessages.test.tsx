import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiChatMessage } from '../AiChatMessage';
import { AiChatMessageList } from '../AiChatMessageList';
import type { AiMessageRecord } from '../../../../domain/ai/models/ai.types';

describe('AI Message Rendering & Message List', () => {
  describe('AiChatMessage', () => {
    it('renders user message cleanly', () => {
      const userMessage: AiMessageRecord = {
        id: 'msg-u1',
        threadId: 'th-1',
        role: 'user',
        content: 'Explain the difference between mitosis and meiosis',
        status: 'complete',
        createdAt: '2026-08-25T01:00:00.000Z',
      };

      render(<AiChatMessage message={userMessage} />);
      expect(screen.getByText('Explain the difference between mitosis and meiosis')).toBeInTheDocument();
      expect(screen.getByTestId('ai-message-msg-u1')).toBeInTheDocument();
    });

    it('renders assistant message with sanitized Markdown formatting', () => {
      const assistantMessage: AiMessageRecord = {
        id: 'msg-a1',
        threadId: 'th-1',
        role: 'assistant',
        content: '### Key Differences\n\n* **Mitosis**: 2 identical cells\n* **Meiosis**: 4 diverse gametes\n\n<script>alert("unsafe")</script>',
        status: 'complete',
        createdAt: '2026-08-25T01:00:02.000Z',
      };

      const { container } = render(<AiChatMessage message={assistantMessage} />);
      expect(screen.getByRole('heading', { level: 3, name: 'Key Differences' })).toBeInTheDocument();
      expect(screen.getByText('Mitosis')).toBeInTheDocument();
      expect(screen.getByText('Meiosis')).toBeInTheDocument();

      // Ensure script tag was sanitized out
      expect(container.querySelector('script')).toBeNull();
    });

    it('renders streaming state with indicator', () => {
      const streamingMessage: AiMessageRecord = {
        id: 'msg-a2',
        threadId: 'th-1',
        role: 'assistant',
        content: 'The heart has four chambers...',
        status: 'streaming',
        createdAt: '2026-08-25T01:00:03.000Z',
      };

      render(<AiChatMessage message={streamingMessage} />);
      expect(screen.getByText('The heart has four chambers...')).toBeInTheDocument();
      expect(screen.getByText('Generating response…')).toBeInTheDocument();
    });

    it('renders error banner with retry button', () => {
      const onRetry = vi.fn();
      const errorMessage: AiMessageRecord = {
        id: 'msg-a3',
        threadId: 'th-1',
        role: 'assistant',
        content: '',
        status: 'error',
        metadata: {
          errorMessage: 'Worker rate limit exceeded.',
        },
        createdAt: '2026-08-25T01:00:04.000Z',
      };

      render(<AiChatMessage message={errorMessage} onRetry={onRetry} />);
      expect(screen.getByText('Worker rate limit exceeded.')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Retry generating response/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledWith('msg-a3');
    });

    it('renders INTERRUPTED badge on crashed turns', () => {
      const interruptedMessage: AiMessageRecord = {
        id: 'msg-a4',
        threadId: 'th-1',
        role: 'assistant',
        content: 'Half completed text...',
        status: 'error',
        metadata: {
          errorCode: 'INTERRUPTED',
          errorMessage: 'Generation was interrupted.',
        },
        createdAt: '2026-08-25T01:00:05.000Z',
      };

      render(<AiChatMessage message={interruptedMessage} />);
      expect(screen.getByText('Interrupted')).toBeInTheDocument();
      expect(screen.getByText('Generation was interrupted.')).toBeInTheDocument();
    });
  });

  describe('AiChatMessageList', () => {
    it('renders empty state with starter prompt buttons and invokes onSendMessage', () => {
      const onSend = vi.fn();
      render(
        <AiChatMessageList
          messages={[]}
          mode="assistant"
          onSendMessage={onSend}
        />,
      );

      expect(screen.getByText('AI Study Assistant')).toBeInTheDocument();
      const starterBtn = screen.getByRole('button', { name: /Summarize the core concepts/i });
      fireEvent.click(starterBtn);
      expect(onSend).toHaveBeenCalledWith(
        'Can you summarize the core concepts of this study material into concise bullet points?',
      );
    });

    it('renders list of messages', () => {
      const messages: AiMessageRecord[] = [
        {
          id: 'u-1',
          threadId: 'th-1',
          role: 'user',
          content: 'Hello AI',
          status: 'complete',
          createdAt: '2026-08-25T01:00:00.000Z',
        },
        {
          id: 'a-1',
          threadId: 'th-1',
          role: 'assistant',
          content: 'Hello! How can I help with your studies today?',
          status: 'complete',
          createdAt: '2026-08-25T01:00:01.000Z',
        },
      ];

      render(<AiChatMessageList messages={messages} />);
      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help with your studies today?')).toBeInTheDocument();
    });
  });
});
