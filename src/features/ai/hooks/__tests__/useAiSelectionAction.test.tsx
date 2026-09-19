import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAiSelectionAction } from '../useAiSelectionAction';

const selectionContext = {
  text: 'The sinoatrial node initiates the heartbeat.',
  action: 'explain' as const,
  sectionHeading: 'Cardiac Conduction',
};

function setup(overrides: Partial<Parameters<typeof useAiSelectionAction>[0]> = {}) {
  const send = vi.fn();
  const onHandled = vi.fn();

  const view = renderHook((props: Parameters<typeof useAiSelectionAction>[0]) =>
    useAiSelectionAction(props),
  {
    initialProps: {
      isOpen: true,
      materialId: 'm1',
      documentContext: '# Cells',
      selectionContext,
      send,
      onHandled,
      ...overrides,
    },
  });

  return { ...view, send, onHandled };
}

describe('useAiSelectionAction', () => {
  it('dispatches the action and clears the selection', () => {
    const { send, onHandled } = setup();

    expect(send).toHaveBeenCalledTimes(1);
    const [prompt, options] = send.mock.calls[0];
    expect(prompt).toContain('Please explain the following excerpt');
    expect(options.selection).toEqual({
      text: selectionContext.text,
      surroundingHeading: 'Cardiac Conduction',
    });
    expect(options.documentContext).toEqual({ id: 'm1', markdown: '# Cells' });
    expect(onHandled).toHaveBeenCalledTimes(1);
  });

  it('does not re-dispatch when the same context is passed again as a new object', () => {
    const { send, rerender } = setup();

    rerender({
      isOpen: true,
      materialId: 'm1',
      documentContext: '# Cells',
      selectionContext: { ...selectionContext },
      send: vi.fn(),
      onHandled: vi.fn(),
    });

    // The dispatch happened once, on the first render.
    expect(send).toHaveBeenCalledTimes(1);
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

  it('omits the material grounding when there is no document', () => {
    const { send } = setup({ documentContext: undefined });

    expect(send.mock.calls[0][1].documentContext).toBeUndefined();
  });

  it('falls back to a generic document id for the global assistant', () => {
    const { send } = setup({ materialId: undefined });

    expect(send.mock.calls[0][1].documentContext).toEqual({
      id: 'current-doc',
      markdown: '# Cells',
    });
  });

  it('dispatches a different excerpt independently', () => {
    const { send, rerender } = setup();

    rerender({
      isOpen: true,
      materialId: 'm1',
      documentContext: '# Cells',
      selectionContext: { text: 'A different excerpt.', action: 'simplify' },
      send,
      onHandled: vi.fn(),
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toContain('Please simplify this concept');
  });
});
