import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollectionShelf } from '../CollectionShelf';
import type { Collection } from '../../../../domain/collections/models/Collection';

const now = '2026-08-01T00:00:00.000Z';
const ROW_HEIGHT = 340;

function makeCollections(n: number): Collection[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c-${i + 1}`,
    title: `Shelf Collection ${i + 1}`,
    order: i,
    createdAt: now,
    updatedAt: now,
  }));
}

describe('CollectionShelf virtualization', () => {
  beforeEach(() => {
    // jsdom has no layout and the virtualizer measures `offsetHeight`: give
    // every measured row a fixed height so it computes a real visible window.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('renders every card on the plain path (small library)', () => {
    render(
      <CollectionShelf collections={makeCollections(3)} counts={{}} onOpen={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(screen.getByText('Shelf Collection 3')).toBeInTheDocument();
  });

  it('virtualizes past the threshold: first rows render, the tail stays unmounted', () => {
    render(
      <CollectionShelf
        collections={makeCollections(30)}
        counts={{}}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    // Lanes fall back to 1 without matchMedia; ~7 rows fit the viewport.
    expect(screen.getByText('Shelf Collection 1')).toBeInTheDocument();
    expect(screen.queryByText('Shelf Collection 30')).not.toBeInTheDocument();
  });
});
