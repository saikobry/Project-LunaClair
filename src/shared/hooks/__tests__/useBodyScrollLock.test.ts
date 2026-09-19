import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBodyScrollLock } from '../useBodyScrollLock';

describe('useBodyScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not touch body scroll while inactive', () => {
    document.body.style.overflow = 'auto';
    renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe('auto');
  });

  it('locks body scroll while active and releases on unmount', () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the previous value instead of clearing it', () => {
    document.body.style.overflow = 'scroll';

    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('releases when the active flag flips to false', () => {
    const { rerender } = renderHook(
      (isActive: boolean) => useBodyScrollLock(isActive),
      { initialProps: true },
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(false);
    expect(document.body.style.overflow).toBe('');
  });
});
