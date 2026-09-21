import { describe, expect, it } from 'vitest';
import { projectRequestMessages } from '../aiRequestProjection';
import type { AiMessageRecord } from '../../models/ai.types';

function user(id: string, content = 'Question?'): AiMessageRecord {
  return { id, threadId: 't1', role: 'user', content, status: 'complete', createdAt: `2026-01-01T00:00:0${id}.000Z` };
}

function assistant(
  id: string,
  content: string,
  status: AiMessageRecord['status'] = 'complete',
): AiMessageRecord {
  return { id, threadId: 't1', role: 'assistant', content, status, createdAt: `2026-01-01T00:00:1${id}.000Z` };
}

describe('projectRequestMessages', () => {
  it('keeps a completed exchange in order', () => {
    const projected = projectRequestMessages([user('1'), assistant('1', 'Answer.')]);

    expect(projected.map((m) => m.content)).toEqual(['Question?', 'Answer.']);
  });

  it('drops an unsettled placeholder rather than sending it as an empty reply', () => {
    const projected = projectRequestMessages([user('1'), assistant('1', '', 'streaming')]);

    expect(projected.map((m) => m.role)).toEqual(['user']);
  });

  it('drops an empty error turn together with the prompt it answers', () => {
    // The pair exists so the failure is visible and retryable in the transcript, but a failed
    // exchange is not history: re-sending it asks a question the model never answered.
    const projected = projectRequestMessages([
      user('1'),
      assistant('1', 'Answer.', 'complete'),
      user('2', 'Failed question?'),
      assistant('2', '', 'error'),
    ]);

    expect(projected.map((m) => m.content)).toEqual(['Question?', 'Answer.']);
  });

  it('keeps an error turn that carries text the user actually saw', () => {
    const projected = projectRequestMessages([user('1'), assistant('1', 'Partial ans', 'error')]);

    expect(projected.map((m) => m.content)).toEqual(['Question?', 'Partial ans']);
  });

  it('drops a completed turn with no content without taking its prompt with it', () => {
    // An unanswered question is a normal state; only a *failed* exchange is retracted as a unit.
    const projected = projectRequestMessages([user('1'), assistant('1', '   ')]);

    expect(projected.map((m) => m.role)).toEqual(['user']);
  });

  it('leaves a trailing unanswered prompt in place', () => {
    const projected = projectRequestMessages([user('1'), assistant('1', 'Answer.'), user('2')]);

    expect(projected.map((m) => m.content)).toEqual(['Question?', 'Answer.', 'Question?']);
  });

  it('drops an empty error turn that has no prompt to retract', () => {
    const projected = projectRequestMessages([assistant('1', '', 'error')]);

    expect(projected).toEqual([]);
  });
});
