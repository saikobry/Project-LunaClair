import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppRoute } from '../useAppRoute';

describe('useAppRoute goBack', () => {
  it('falls back to home when there is no in-app history', () => {
    window.history.replaceState({}, '', '/settings');
    const { result } = renderHook(() => useAppRoute());

    expect(result.current.currentRoute).toEqual({ kind: 'settings' });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentRoute).toEqual({ kind: 'home' });
  });

  it('returns to the last in-app route', () => {
    window.history.replaceState({}, '', '/');
    const { result } = renderHook(() => useAppRoute());

    act(() => {
      result.current.navigate({ kind: 'library' });
    });
    act(() => {
      result.current.navigate({ kind: 'settings' });
    });
    expect(result.current.currentRoute).toEqual({ kind: 'settings' });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentRoute).toEqual({ kind: 'library' });
  });

  it('ignores same-route navigations so back never loops onto the same page', () => {
    window.history.replaceState({}, '', '/');
    const { result } = renderHook(() => useAppRoute());

    act(() => {
      result.current.navigate({ kind: 'library' });
    });
    act(() => {
      result.current.navigate({ kind: 'library' });
    });
    act(() => {
      result.current.navigate({ kind: 'settings' });
    });

    act(() => {
      result.current.goBack();
    });

    expect(result.current.currentRoute).toEqual({ kind: 'library' });
  });
});
