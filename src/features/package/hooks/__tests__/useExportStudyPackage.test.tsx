import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useExportStudyPackage } from '../useExportStudyPackage';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { StudyPackage } from '../../../../domain/package/models/package.types';
import * as fileDownloadUtils from '../../../../shared/utils/fileDownload';

const showToastMock = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('useExportStudyPackage', () => {
  const mockStudyPackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Cell Biology: Chapter 1',
      description: 'Intro to cellular processes',
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Cell Biology: Chapter 1',
        documentContent: '# Intro to Cells',
      },
    ],
    questions: [],
    quizzes: [],
  };

  let mockMaterializeExecute: ReturnType<typeof vi.fn>;
  let triggerBlobDownloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaterializeExecute = vi.fn().mockResolvedValue(mockStudyPackage);
    triggerBlobDownloadSpy = vi.spyOn(fileDownloadUtils, 'triggerBlobDownload').mockImplementation(() => {});
  });

  function createWrapper() {
    const mockContextValue = {
      useCases: {
        package: {
          materializeStudyPackage: {
            execute: mockMaterializeExecute,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return ({ children }: { children: ReactNode }) => (
      <ApplicationContext.Provider value={mockContextValue}>
        {children}
      </ApplicationContext.Provider>
    );
  }

  it('exports package successfully, triggers blob download, and calls onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => useExportStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isExporting).toBe(false);

    let exportPromise: Promise<void>;
    await act(async () => {
      exportPromise = result.current.exportPackage('mat-123');
    });
    await exportPromise!;

    expect(mockMaterializeExecute).toHaveBeenCalledWith({ materialId: 'mat-123' });
    expect(triggerBlobDownloadSpy).toHaveBeenCalledTimes(1);
    expect(triggerBlobDownloadSpy).toHaveBeenCalledWith(
      expect.any(Blob),
      'Cell Biology_ Chapter 1.lcpack'
    );
    expect(showToastMock).toHaveBeenCalledWith('Exported "Cell Biology: Chapter 1" as .lcpack', {
      intent: 'success',
    });
    expect(onSuccess).toHaveBeenCalledWith('Cell Biology: Chapter 1');
    expect(onError).not.toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  it('handles errors gracefully, calls onError callback, and resets isExporting to false', async () => {
    const error = new Error('Material not found');
    mockMaterializeExecute.mockRejectedValueOnce(error);

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => useExportStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.exportPackage('non-existent');
    });

    expect(mockMaterializeExecute).toHaveBeenCalledWith({ materialId: 'non-existent' });
    expect(triggerBlobDownloadSpy).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('Material not found', {
      intent: 'error',
    });
    expect(onError).toHaveBeenCalledWith(error);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  /**
   * The nameless-package branch.
   *
   * This hook used to reach its `|| 'study-package'` filename fallback whenever a materialized
   * package carried an empty `metadata.title`, and a test pinned that. The strict export gate now
   * refuses such a package outright - an `.lcpack` with no title is one no share endpoint accepts -
   * and `MaterializeStudyPackageUseCase` builds `metadata.title` from the material's own non-empty
   * title, so the fallback is defence-in-depth rather than a reachable path. The test is therefore
   * inverted: it pins the behaviour that replaced it, that a nameless package is refused and no
   * file is written.
   */
  it('refuses to export a package with no title, which the strict tier requires to be non-empty', async () => {
    const unnamedPackage: StudyPackage = {
      ...mockStudyPackage,
      metadata: {
        ...mockStudyPackage.metadata,
        title: '',
      },
    };
    mockMaterializeExecute.mockResolvedValueOnce(unnamedPackage);

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => useExportStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.exportPackage('mat-no-title');
    });

    expect(triggerBlobDownloadSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect((onError.mock.calls[0][0] as Error).message).toMatch(
      /Cannot export this material: Package metadata "title" must be a non-empty string\./,
    );
  });

  /**
   * The local export gate — the same strict tier publication runs, on the same reasoning: an
   * `.lcpack` is something else has to be able to clone, and materialization copies each question's
   * payload verbatim, so a question that arrived malformed from a legacy share would otherwise be
   * written straight back out.
   *
   * This fails if the `validateStudyPackage(..., { strictness: 'publish' })` call is removed: the
   * blob would then be downloaded and the success toast shown.
   */
  it('refuses to export a package the strict client tier rejects, and writes no file', async () => {
    const malformedPackage: StudyPackage = {
      ...mockStudyPackage,
      questions: [
        {
          id: 'pkg_q_legacy_cloze',
          materialId: 'pkg_mat_1',
          type: 'fill_in_blank',
          prompt: 'Fill in the blanks.',
          payload: {
            type: 'fill_in_blank',
            // Two `___` markers, one answer — the shape a pre-validation share carries.
            template: 'The ___ is the ___ of the cell.',
            blanks: ['nucleus'],
          },
          difficulty: 'medium',
          points: 1,
        },
      ],
    };
    mockMaterializeExecute.mockResolvedValueOnce(malformedPackage);

    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => useExportStudyPackage({ onSuccess, onError }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.exportPackage('mat-legacy');
    });

    expect(triggerBlobDownloadSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toMatch(
      /Cannot export this material: Question "pkg_q_legacy_cloze": fill_in_blank payload requires exactly one answer per/
    );
    expect(showToastMock).toHaveBeenCalledWith(expect.stringMatching(/Cannot export this material/), {
      intent: 'error',
    });
    expect(result.current.isExporting).toBe(false);
  });
});
