import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { buildSelectionActionPrompt } from '../../utils/selectionActionPrompt';
import { useAiSelectionAction } from '../useAiSelectionAction';
import type { AiMessageRecord } from '../../../../domain/ai/models/ai.types';

const selectionContext = {
  text: 'The sinoatrial node initiates the heartbeat.',
  action: 'explain' as const,
  sectionHeading: 'Cardiac Conduction',
};

const expectedPrompt = buildSelectionActionPrompt('explain', selectionContext.text);

function userTurn(content: string): AiMessageRecord {
  return {
    id: `user-${content.length}`,
    threadId: 'thread-1',
    role: 'user',
    content,
    status: 'complete',
    createdAt: new Date().toISOString(),
  };
}

function setup(overrides: Partial<Parameters<typeof useAiSelectionAction>[0]> = {}) {
  const send = vi.fn();
  const onHandled = vi.fn();

  const view = renderHook((props: Parameters<typeof useAiSelectionAction>[0]) =>
    useAiSelectionAction(props),
  {
    initialProps: {
      isOpen: true,
      ready: true,
      selectionContext,
      messages: [],
      send,
      onHandled,
      ...overrides,
    },
  });

  return { ...view, send, onHandled };
}

describe('useAiSelectionAction', () => {
  it('dispatches the action but clears the selection only once the turn lands', () => {
    const { send, onHandled, rerender } = setup();

    expect(send).toHaveBeenCalledTimes(1);
    const [prompt, options] = send.mock.calls[0];
    expect(prompt).toContain('Please explain the following excerpt');
    expect(options.selection).toEqual({
      text: selectionContext.text,
      surroundingHeading: 'Cardiac Conduction',
    });
    // Dispatched, but nothing is on the transcript yet — the request must not
    // be forgotten before it persists.
    expect(onHandled).not.toHaveBeenCalled();

    rerender({
      isOpen: true,
      ready: true,
      selectionContext,
      messages: [userTurn(expectedPrompt)],
      send,
      onHandled,
    });
    expect(onHandled).toHaveBeenCalledTimes(1);
  });

  it('waits for the session to settle before dispatching', () => {
    const { send, rerender } = setup({ ready: false });

    // Mount-time auto-send during the resolving session is what a mount abort
    // (StrictMode's unmount simulation in dev) kills mid-flight, orphaning an
    // empty thread — so nothing fires until the session is ready.
    expect(send).not.toHaveBeenCalled();

    rerender({
      isOpen: true,
      ready: true,
      selectionContext,
      messages: [],
      send,
      onHandled: vi.fn(),
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not re-dispatch when the same context is passed again as a new object', () => {
    const { send, rerender } = setup();

    rerender({
      isOpen: true,
      ready: true,
      selectionContext: { ...selectionContext },
      messages: [],
      send: vi.fn(),
      onHandled: vi.fn(),
    });

    // The dispatch happened once, on the first render.
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('requests a distinct session when forceNewThread is set', () => {
    const { send } = setup({ forceNewThread: true });

    expect(send).toHaveBeenCalledTimes(1);
    const [, options] = send.mock.calls[0];
    expect(options.freshSession).toBe(true);
  });

  it('continues the active session by default', () => {
    const { send } = setup();

    expect(send).toHaveBeenCalledTimes(1);
    const [, options] = send.mock.calls[0];
    expect(options.freshSession).toBeUndefined();
  });

  it('stays silent while the drawer is closed', () => {
    const { send, onHandled } = setup({ isOpen: false });

    expect(send).not.toHaveBeenCalled();
    expect(onHandled).not.toHaveBeenCalled();
  });

  it('ignores a selection with no action attached', () => {
    const { send } = setup({ selectionContext: { text: 'Some highlighted text' } });

    expect(send).not.toHaveBeenCalled();
  });

  // Grounding is no longer a per-send option: the conversation carries it and `AiGroundingResolver`
  // reads the document from that record, so these selection actions attach only the excerpt.

  it('dispatches a different excerpt independently', () => {
    const { send, rerender } = setup();

    rerender({
      isOpen: true,
      ready: true,
      selectionContext: { text: 'A different excerpt.', action: 'simplify' },
      messages: [],
      send,
      onHandled: vi.fn(),
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain('Please simplify this concept');
  });

  it('resends the same action once the context clears and returns', () => {
    const { send, rerender, onHandled } = setup();

    // First turn lands and clears the selection.
    rerender({
      isOpen: true,
      ready: true,
      selectionContext,
      messages: [userTurn(expectedPrompt)],
      send,
      onHandled,
    });
    expect(onHandled).toHaveBeenCalledTimes(1);

    rerender({
      isOpen: true,
      ready: true,
      selectionContext: null,
      messages: [userTurn(expectedPrompt)],
      send,
      onHandled,
    });

    // Deliberately invoking the same action again is a new request.
    rerender({
      isOpen: true,
      ready: true,
      selectionContext: { ...selectionContext },
      messages: [userTurn(expectedPrompt)],
      send,
      onHandled,
    });
    expect(send).toHaveBeenCalledTimes(2);
    // The previous turn is already in messages, but the new one has not landed yet.
    // onHandled must NOT be invoked prematurely.
    expect(onHandled).toHaveBeenCalledTimes(1);

    // Once the second turn appears in messages, onHandled fires.
    rerender({
      isOpen: true,
      ready: true,
      selectionContext: { ...selectionContext },
      messages: [userTurn(expectedPrompt), userTurn(expectedPrompt)],
      send,
      onHandled,
    });
    expect(onHandled).toHaveBeenCalledTimes(2);
  });
});
