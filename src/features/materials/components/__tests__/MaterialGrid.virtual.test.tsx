import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaterialGrid from '../MaterialGrid';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const now = '2026-08-01T00:00:00.000Z';
const ROW_HEIGHT = 340;

function makeMaterials(n: number): StudyMaterial[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `m-${i + 1}`,
    title: `Grid Material ${i + 1}`,
    documentId: `doc-${i + 1}`,
    createdAt: now,
    updatedAt: now,
  }));
}

describe('MaterialGrid virtualization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // jsdom has no layout and the virtualizer measures `offsetHeight`: give
    // every measured row a fixed height so it computes a real visible window.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(ROW_HEIGHT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderGrid(count: number) {
    const mockContextValue = {
      repositories: {
        collection: { getAll: vi.fn().mockResolvedValue([]) },
        collectionMaterial: { getByMaterialId: vi.fn().mockResolvedValue([]) },
        library: { getMaterials: vi.fn().mockResolvedValue([]) },
      },
      useCases: { collections: {} },
    } as unknown as ApplicationContextValue;

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            <MaterialGrid
              materials={makeMaterials(count)}
              onOpen={vi.fn()}
              onEdit={vi.fn()}
              onRemove={vi.fn()}
              onStartQuiz={vi.fn()}
              onManage={vi.fn()}
            />
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it('renders every card on the plain path (small library)', () => {
    renderGrid(3);
    expect(screen.getByText('Grid Material 3')).toBeInTheDocument();
  });

  it('virtualizes past the threshold: first rows render, the tail stays unmounted', () => {
    renderGrid(30);
    // Lanes fall back to 1 without layout APIs; ~7 rows fit the viewport.
    expect(screen.getByText('Grid Material 1')).toBeInTheDocument();
    expect(screen.queryByText('Grid Material 30')).not.toBeInTheDocument();
  });
});
