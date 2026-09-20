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

    it('shows the token count and cost of a settled assistant turn', () => {
      const meteredMessage: AiMessageRecord = {
        id: 'msg-a5',
        threadId: 'th-1',
        role: 'assistant',
        content: 'The sinoatrial node is the natural pacemaker.',
        status: 'complete',
        createdAt: '2026-08-25T01:00:06.000Z',
        metadata: {
          usage: { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 },
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        },
      };

      render(<AiChatMessage message={meteredMessage} />);

      const usageLine = screen.getByTestId('ai-usage-msg-a5');
      expect(usageLine).toHaveTextContent('5,132 tokens');
      expect(usageLine).toHaveTextContent('$0.0021');
      // The serving model is named; a turn persisted by an older build records the provider's own
      // model id, which resolves to the catalog's display name.
      expect(usageLine).toHaveTextContent('Standard');
      // The prompt/completion split is available on hover rather than spent as transcript space.
      expect(usageLine).toHaveAttribute('title', '4,820 in · 312 out');
    });

    it('reports tokens without a cost when the serving model has no published rate', () => {
      const meteredMessage: AiMessageRecord = {
        id: 'msg-a6',
        threadId: 'th-1',
        role: 'assistant',
        content: 'Served by a model we cannot price.',
        status: 'complete',
        createdAt: '2026-08-25T01:00:07.000Z',
        metadata: {
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'unpriced-model',
        },
      };

      render(<AiChatMessage message={meteredMessage} />);

      const usageLine = screen.getByTestId('ai-usage-msg-a6');
      expect(usageLine).toHaveTextContent('150 tokens');
      // Unknown is not the same as free, so no cost is asserted in either direction.
      expect(usageLine).not.toHaveTextContent('$');
    });

    it('names the model per turn, so a thread that switched models is visibly mixed', () => {
      const maxServed: AiMessageRecord = {
        id: 'msg-a8',
        threadId: 'th-1',
        role: 'assistant',
        content: 'A longer-window answer.',
        status: 'complete',
        createdAt: '2026-09-19T01:00:00.000Z',
        metadata: {
          usage: { promptTokens: 900, completionTokens: 100, totalTokens: 1_000 },
          model: 'ukisai-swift-max',
        },
      };
      const unknownServed: AiMessageRecord = {
        id: 'msg-a9',
        threadId: 'th-1',
        role: 'assistant',
        content: 'Served by a model this build does not know.',
        status: 'complete',
        createdAt: '2026-09-19T01:00:01.000Z',
        metadata: {
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'brand-new-model',
        },
      };

      render(
        <>
          <AiChatMessage message={maxServed} />
          <AiChatMessage message={unknownServed} />
        </>
      );

      expect(screen.getByTestId('ai-usage-msg-a8')).toHaveTextContent('MAX');
      // Never mislabelled as another model: an id the catalog cannot name is shown as itself.
      expect(screen.getByTestId('ai-usage-msg-a9')).toHaveTextContent('brand-new-model');
    });

    it('omits the usage line when no telemetry was recorded', () => {
      const plainMessage: AiMessageRecord = {
        id: 'msg-a7',
        threadId: 'th-1',
        role: 'assistant',
        content: 'This turn predates usage telemetry.',
        status: 'complete',
        createdAt: '2026-08-25T01:00:08.000Z',
      };
      const userMessage: AiMessageRecord = {
        id: 'msg-u7',
        threadId: 'th-1',
        role: 'user',
        content: 'A question never carries provider telemetry.',
        status: 'complete',
        createdAt: '2026-08-25T01:00:09.000Z',
      };

      render(
        <>
          <AiChatMessage message={plainMessage} />
          <AiChatMessage message={userMessage} />
        </>,
      );

      expect(screen.queryByTestId('ai-usage-msg-a7')).toBeNull();
      expect(screen.queryByTestId('ai-usage-msg-u7')).toBeNull();
    });
  });

  describe('AiChatMessageList', () => {
    it('renders empty state with starter prompt buttons and invokes onSendMessage', () => {
      const onSend = vi.fn();
      render(
        <AiChatMessageList
          messages={[]}
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

    it('projects the in-flight turn so the transcript is not empty while generating', () => {
      render(
        <AiChatMessageList
          messages={[]}
          isStreaming={true}
          streamingText=""
          activity={{ label: 'Thinking…', elapsedMs: 0, isStalled: false }}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Thinking…');
    });

    it('renders accumulated tokens live and switches the label once text flows', () => {
      render(
        <AiChatMessageList
          messages={[]}
          isStreaming={true}
          streamingText="The heart has four "
          activity={null}
        />,
      );

      expect(screen.getByText(/The heart has four/)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Writing…');
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
