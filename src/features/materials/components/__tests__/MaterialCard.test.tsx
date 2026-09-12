import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaterialCard } from '../MaterialCard';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

const mockMaterial: StudyMaterial = {
  id: 'mat-1',
  title: 'Cell Biology',
  documentId: 'doc-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

function renderCard(props: Partial<Parameters<typeof MaterialCard>[0]> = {}) {
  const onOpen = vi.fn();
  const onNavigate = vi.fn();
  const mockContextValue = {
    repositories: {
      collection: { getAll: vi.fn().mockResolvedValue([]) },
      collectionMaterial: { getByMaterialId: vi.fn().mockResolvedValue([]) },
      library: { getMaterials: vi.fn().mockResolvedValue([mockMaterial]) },
    },
    useCases: { collections: {} },
  } as unknown as ApplicationContextValue;
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ApplicationContext.Provider value={mockContextValue}>
          <MaterialCard
            material={mockMaterial}
            onOpen={onOpen}
            onNavigate={onNavigate}
            {...props}
          />
        </ApplicationContext.Provider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onOpen, onNavigate };
}

describe('MaterialCard', () => {
  it('renders the card with material title', () => {
    renderCard();
    expect(screen.getByText('Cell Biology')).toBeInTheDocument();
  });
});
