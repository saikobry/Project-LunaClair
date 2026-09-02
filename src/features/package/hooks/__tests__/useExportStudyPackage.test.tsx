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
    flashcards: [],
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

  it('uses default fallback filename when package metadata title is missing', async () => {
    const unnamedPackage: StudyPackage = {
      ...mockStudyPackage,
      metadata: {
        ...mockStudyPackage.metadata,
        title: '',
      },
    };
    mockMaterializeExecute.mockResolvedValueOnce(unnamedPackage);

    const { result } = renderHook(
      () => useExportStudyPackage(),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.exportPackage('mat-no-title');
    });

    expect(triggerBlobDownloadSpy).toHaveBeenCalledWith(
      expect.any(Blob),
      'study-package.lcpack'
    );
    expect(showToastMock).toHaveBeenCalledWith('Exported "study-package" as .lcpack', {
      intent: 'success',
    });
    expect(result.current.isExporting).toBe(false);
  });
});
