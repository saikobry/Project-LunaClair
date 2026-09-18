import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MaterialWorkspaceTab } from '../../../../routing/routing';
import { useVisitedTabs } from '../useVisitedTabs';

describe('useVisitedTabs', () => {
  it('starts with only the entry tab visited', () => {
    const { result } = renderHook(() => useVisitedTabs('read'));
    expect(result.current).toEqual(['read']);
  });

  it('remembers every tab visited this session, in order', () => {
    const { result, rerender } = renderHook(({ tab }: { tab: MaterialWorkspaceTab }) => useVisitedTabs(tab), {
      initialProps: { tab: 'read' as MaterialWorkspaceTab },
    });
    rerender({ tab: 'quiz' });
    rerender({ tab: 'flashcards' });
    rerender({ tab: 'quiz' });
    expect(result.current).toEqual(['read', 'quiz', 'flashcards']);
  });

  it('never drops a visited tab when the active tab changes', () => {
    const { result, rerender } = renderHook(({ tab }: { tab: MaterialWorkspaceTab }) => useVisitedTabs(tab), {
      initialProps: { tab: 'write' as MaterialWorkspaceTab },
    });
    rerender({ tab: 'attachments' });
    expect(result.current).toContain('write');
    expect(result.current).toContain('attachments');
  });
});
