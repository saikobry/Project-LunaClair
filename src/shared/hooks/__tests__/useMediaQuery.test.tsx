import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

function Probe({ query, defaultValue }: { query: string; defaultValue?: boolean }) {
  const matches = useMediaQuery(query, defaultValue);
  return <span>{matches ? 'match' : 'no-match'}</span>;
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the default value when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByText('no-match')).toBeInTheDocument();
  });

  it('returns the current match and follows change events', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>();
    let current = false;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: current,
        addEventListener: vi.fn((_type: string, cb: (e: { matches: boolean }) => void) => {
          listeners.add(cb);
        }),
        removeEventListener: vi.fn((_type: string, cb: (e: { matches: boolean }) => void) => {
          listeners.delete(cb);
        }),
      })),
    );

    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByText('no-match')).toBeInTheDocument();

    act(() => {
      current = true;
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(screen.getByText('match')).toBeInTheDocument();
  });
});
