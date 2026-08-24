import { describe, it, expect } from 'vitest';
import type { AiChatMessage, AiChatRequest, AiStreamEvent } from '../ai.types';
import type { AiService } from '../AiService';

describe('AI Domain Contracts', () => {
  it('instantiates valid domain chat request and messages', () => {
    const message: AiChatMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'What is the function of the sinoatrial node?',
      createdAt: '2026-08-25T00:00:00.000Z',
    };

    const request: AiChatRequest = {
      messages: [message],
      documentContext: {
        id: 'doc-cardio',
        title: 'Cardiovascular System',
        markdown: '# Cardiovascular System\nThe sinoatrial node is the natural pacemaker of the heart.',
      },
      mode: 'assistant',
    };

    expect(request.messages).toHaveLength(1);
    expect(request.documentContext?.id).toBe('doc-cardio');
    expect(request.mode).toBe('assistant');
  });

  it('allows implementing an AiService stream', async () => {
    const mockService: AiService = {
      async *streamChat(_req: AiChatRequest): AsyncIterable<AiStreamEvent> {
        yield { type: 'start', messageId: 'msg-response' };
        yield { type: 'token', text: 'It acts ' };
        yield { type: 'token', text: 'as the pacemaker.' };
        yield { type: 'done', usage: { promptTokens: 10, completionTokens: 6 } };
      },
    };

    const events: AiStreamEvent[] = [];
    for await (const event of mockService.streamChat({
      messages: [{ id: '1', role: 'user', content: 'hi', createdAt: new Date().toISOString() }],
      mode: 'assistant',
    })) {
      events.push(event);
    }

    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({ type: 'start', messageId: 'msg-response' });
    expect(events[1]).toEqual({ type: 'token', text: 'It acts ' });
    expect(events[2]).toEqual({ type: 'token', text: 'as the pacemaker.' });
    expect(events[3]).toEqual({ type: 'done', usage: { promptTokens: 10, completionTokens: 6 } });
  });
});
