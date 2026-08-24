import { describe, it, expect } from 'vitest';
import { SendChatMessageUseCase } from '../SendChatMessageUseCase';
import { MockAiAdapter } from '../../../../infrastructure/ai/MockAiAdapter';
import type { AiStreamEvent } from '../../../../domain/ai/ai.types';

describe('SendChatMessageUseCase', () => {
  it('streams response events through AiService', async () => {
    const mockAi = new MockAiAdapter({
      tokens: ['Pacemaker', ' of ', 'the heart.'],
    });
    const useCase = new SendChatMessageUseCase(mockAi);

    const stream = useCase.execute({
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'What is the SA node?',
          createdAt: new Date().toISOString(),
        },
      ],
      document: {
        id: 'doc-1',
        title: 'Anatomy & Physiology',
        markdown: '# Cardiovascular System\nThe sinoatrial node is the pacemaker.',
      },
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(2);
    expect(events[0].type).toBe('start');
    expect(events[1]).toEqual({ type: 'token', text: 'Pacemaker' });
    expect(events[events.length - 1].type).toBe('done');
  });

  it('yields validation error when messages array is empty', async () => {
    const mockAi = new MockAiAdapter();
    const useCase = new SendChatMessageUseCase(mockAi);

    const stream = useCase.execute({
      messages: [],
      mode: 'assistant',
    });

    const events: AiStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'error',
      code: 'VALIDATION_ERROR',
      message: 'At least one message is required to send a chat request.',
    });
  });
});
