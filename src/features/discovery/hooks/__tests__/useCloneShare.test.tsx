import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCloneShare } from '../useCloneShare';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../../app/providers/ToastContext';
import type { ClonePublishedShareResult } from '../../../../application/use-cases/sharing/ClonePublishedShareUseCase';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

const MATERIAL_TITLE = 'Cellular Respiration';
const SHARE_ID = 'share_abc123';

const mockPackage: StudyPackage = {
  format: 'lcpack',
  schemaVersion: 1,
  metadata: { title: MATERIAL_TITLE, createdAt: '2026-08-28T00:00:00.000Z' },
  materials: [
    { id: 'pkg_mat_1', title: MATERIAL_TITLE, documentContent: '# Respiration' },
  ],
  questions: [],
  quizzes: [],
};

function cloneResult(): ClonePublishedShareResult {
  return {
    share: {
      id: SHARE_ID,
      format: 'lcpack',
      schemaVersion: 1,
      title: MATERIAL_TITLE,
      accessType: 'public',
      package: mockPackage,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      viewCount: 0,
      downloadCount: 0,
    },
    importResult: {
      materialIds: ['local_mat_1'],
      questionIds: [],
      quizIds: [],
      assetIds: [],
      idMap: new Map(),
    },
  };
}

describe('useCloneShare', () => {
  let queryClient: QueryClient;
  let mockCloneExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockCloneExecute = vi.fn().mockResolvedValue(cloneResult());
  });

  /**
   * The REAL `ToastProvider` — not a mocked `useToast` — so the assertion is that the message
   * reaches the document through the app-level channel, the same one every other post-clone
   * message rides. That provider is mounted above the routes in the app, which is what makes a
   * message outlive the surface that produced it.
   */
  function createWrapper() {
    const mockContextValue = {
      useCases: {
        sharing: {
          clonePublishedShare: { execute: mockCloneExecute },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ApplicationContext.Provider value={mockContextValue}>
            {children}
          </ApplicationContext.Provider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  it('reports a clean clone as a success and nothing else', async () => {
    const { result } = renderHook(() => useCloneShare(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.cloneShare(SHARE_ID);
    });

    // The negative case: a notice that always rendered would fire on every clean share.
    expect(screen.queryByText(/Some questions were imported in a reduced form/)).not.toBeInTheDocument();
    expect(screen.queryByText(/malformed answer payload/)).not.toBeInTheDocument();
    expect(screen.getByText(`Cloned "${MATERIAL_TITLE}" into library!`)).toBeInTheDocument();
    expect(result.current.cloningId).toBeNull();
  });

  /**
   * The live rejection surface, exercised through the real clone flow's error channel.
   *
   * There is no longer a tolerated-and-reported outcome, so a clone that cannot succeed says so:
   * the thrown message is what the user sees. The error the mock rejects with is the one the
   * REAL `ClonePublishedShareUseCase` produces for a malformed package — a strict
   * `validateStudyPackage` refusal thrown by `ImportStudyPackageUseCase`, which names the
   * offending question — so this pins the presentation of a genuine production failure rather
   * than a hand-written warnings array describing a path that no longer exists.
   */
  it('surfaces a clone refused for malformed content as an error naming the offending question', async () => {
    mockCloneExecute.mockRejectedValueOnce(
      new Error(
        'StudyPackage validation failed:\n- Question "pkg_q_broken_cloze": fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
      ),
    );

    const { result } = renderHook(() => useCloneShare(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.cloneShare(SHARE_ID)).rejects.toThrow('StudyPackage validation failed');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/pkg_q_broken_cloze.*exactly one answer per "___" placeholder/s),
      ).toBeInTheDocument();
    });
    // Never presented as a success, and never as a dialog the user must dismiss.
    expect(screen.queryByText(`Cloned "${MATERIAL_TITLE}" into library!`)).not.toBeInTheDocument();
    expect(screen.queryByText(/Some questions were imported in a reduced form/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('still reports an ordinary clone failure as an error', async () => {
    mockCloneExecute.mockRejectedValueOnce(new Error('Share not found'));

    const { result } = renderHook(() => useCloneShare(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.cloneShare('share_missing')).rejects.toThrow('Share not found');
    });

    await waitFor(() => {
      expect(screen.getByText('Share not found')).toBeInTheDocument();
    });
    expect(result.current.cloningId).toBeNull();
  });
});
