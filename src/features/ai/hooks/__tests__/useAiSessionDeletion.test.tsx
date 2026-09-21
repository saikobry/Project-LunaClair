import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAiSessionDeletion } from '../useAiSessionDeletion';
import type { AiThread } from '../../../../domain/ai/models/ai.types';

const sessions: AiThread[] = [
  {
    id: 'thread-1',
    materialId: 'm1',
    title: 'What is the sinoatrial node?',
    grounding: 'whole',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
  },
];

function setup(overrides: Partial<Parameters<typeof useAiSessionDeletion>[0]> = {}) {
  const deleteSession = vi.fn(async () => undefined);
  const clearHistory = vi.fn(async () => undefined);
  const onCleared = vi.fn();

  const view = renderHook(() =>
    useAiSessionDeletion({ sessions, deleteSession, clearHistory, onCleared, ...overrides }),
  );

  return { ...view, deleteSession, clearHistory, onCleared };
}

describe('useAiSessionDeletion', () => {
  it('starts with nothing pending and no dialog copy', () => {
    const { result } = setup();

    expect(result.current.pendingDeletion).toBeNull();
    expect(result.current.dialogCopy).toBeNull();
  });

  it('names the session being deleted before confirming', () => {
    const { result } = setup();

    act(() => result.current.requestDeleteSession('thread-1'));

    expect(result.current.dialogCopy?.message).toContain('What is the sinoatrial node?');
  });

  it('falls back to a generic name for an unknown session', () => {
    const { result } = setup();

    act(() => result.current.requestDeleteSession('missing'));

    expect(result.current.dialogCopy?.message).toContain('this conversation');
  });

  it('deletes only the requested session', async () => {
    const { result, deleteSession, clearHistory, onCleared } = setup();

    act(() => result.current.requestDeleteSession('thread-1'));
    await act(async () => {
      await result.current.confirmDeletion();
    });

    expect(deleteSession).toHaveBeenCalledWith('thread-1');
    expect(clearHistory).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
    expect(result.current.pendingDeletion).toBeNull();
  });

  it('clears every session and hands the panel back for a scope-wide deletion', async () => {
    const { result, clearHistory, deleteSession, onCleared } = setup();

    act(() => result.current.requestClearAll());
    await act(async () => {
      await result.current.confirmDeletion();
    });

    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('cancels without deleting anything', () => {
    const { result, deleteSession, clearHistory } = setup();

    act(() => result.current.requestClearAll());
    act(() => result.current.cancelDeletion());

    expect(result.current.pendingDeletion).toBeNull();
    expect(deleteSession).not.toHaveBeenCalled();
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it('ignores a confirm with nothing pending', async () => {
    const { result, deleteSession, clearHistory } = setup();

    await act(async () => {
      await result.current.confirmDeletion();
    });

    expect(deleteSession).not.toHaveBeenCalled();
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it('drops the pending action before awaiting, so it cannot be confirmed twice', async () => {
    let resolveDelete: () => void = () => {};
    const deleteSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    const { result } = setup({ deleteSession });

    act(() => result.current.requestDeleteSession('thread-1'));
    let inFlight: Promise<void> = Promise.resolve();
    act(() => {
      inFlight = result.current.confirmDeletion();
    });

    expect(result.current.pendingDeletion).toBeNull();

    await act(async () => {
      resolveDelete();
      await inFlight;
    });

    expect(deleteSession).toHaveBeenCalledTimes(1);
  });
});
