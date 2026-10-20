import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientContext } from '@tanstack/react-query';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../../../infrastructure/database/schema/schema';
import { openVaultDatabase, clearVaultDatabaseCache, type LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { useConflictDrafts } from '../useConflictDrafts';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { readerQueryKeys } from '../../../reader/queries/readerQueryKeys';
import { materialQueryKeys } from '../../../materials/queries/materialQueryKeys';
import type { ConflictDraft } from '../../../../domain/sync/models/sync.types';

describe('useConflictDrafts', () => {
  let mockGetConflictDrafts: { execute: ReturnType<typeof vi.fn> };
  let mockResolveConflictDraft: { execute: ReturnType<typeof vi.fn> };
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockGetConflictDrafts = {
      execute: vi.fn().mockResolvedValue([]),
    };

    mockResolveConflictDraft = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('when db is unavailable (fallback mode)', () => {
    const mockDrafts: ConflictDraft[] = [
      {
        id: 'draft-fallback-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Local Content',
        serverContent: '# Remote Content',
        createdAt: '2026-10-18T10:00:00.000Z',
      },
    ];

    it('falls back to useCases.sync.getConflictDrafts.execute and manages loading', async () => {
      mockGetConflictDrafts.execute.mockResolvedValue([...mockDrafts]);

      const mockContext: any = {
        useCases: {
          sync: {
            getConflictDrafts: mockGetConflictDrafts,
            resolveConflictDraft: mockResolveConflictDraft,
          },
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientContext.Provider value={queryClient}>
          <ApplicationContext.Provider value={mockContext}>
            {children}
          </ApplicationContext.Provider>
        </QueryClientContext.Provider>
      );

      const { result } = renderHook(() => useConflictDrafts('doc-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetConflictDrafts.execute).toHaveBeenCalledWith('doc-1');
      expect(result.current.drafts).toHaveLength(1);
      expect(result.current.drafts[0].id).toBe('draft-fallback-1');
    });

    it('resolveDraft calls resolveConflictDraft use case and invalidates query caches', async () => {
      mockGetConflictDrafts.execute.mockResolvedValue([...mockDrafts]);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const mockContext: any = {
        useCases: {
          sync: {
            getConflictDrafts: mockGetConflictDrafts,
            resolveConflictDraft: mockResolveConflictDraft,
          },
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientContext.Provider value={queryClient}>
          <ApplicationContext.Provider value={mockContext}>
            {children}
          </ApplicationContext.Provider>
        </QueryClientContext.Provider>
      );

      const { result } = renderHook(() => useConflictDrafts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.resolveDraft({
          draftId: 'draft-fallback-1',
          resolution: 'keep_server',
        });
      });

      expect(mockResolveConflictDraft.execute).toHaveBeenCalledWith({
        draftId: 'draft-fallback-1',
        resolution: 'keep_server',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: readerQueryKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: materialQueryKeys.all });
    });
  });

  describe('when db is available (Dexie useLiveQuery mode)', () => {
    let testDb: LunaClairDatabase;

    beforeEach(async () => {
      clearVaultDatabaseCache();
      await Dexie.delete(DB_NAME);
      testDb = openVaultDatabase(DB_NAME);
      await testDb.open();
    });

    afterEach(async () => {
      if (testDb.isOpen()) {
        testDb.close();
      }
      clearVaultDatabaseCache();
      await Dexie.delete(DB_NAME);
    });

    it('queries live drafts from db.conflictDrafts and reactively updates on change', async () => {
      const draft1: ConflictDraft = {
        id: 'draft-live-1',
        documentId: 'doc-live-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Live Local 1',
        serverContent: '# Live Server 1',
        createdAt: '2026-10-18T10:00:00.000Z',
      };
      const draft2: ConflictDraft = {
        id: 'draft-live-2',
        documentId: 'doc-live-2',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Live Local 2',
        serverContent: '# Live Server 2',
        createdAt: '2026-10-18T10:05:00.000Z',
      };

      await testDb.conflictDrafts.put(draft1);
      await testDb.conflictDrafts.put(draft2);

      const mockContext: any = {
        infrastructure: {
          db: testDb,
        },
        useCases: {
          sync: {
            getConflictDrafts: mockGetConflictDrafts,
            resolveConflictDraft: mockResolveConflictDraft,
          },
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientContext.Provider value={queryClient}>
          <ApplicationContext.Provider value={mockContext}>
            {children}
          </ApplicationContext.Provider>
        </QueryClientContext.Provider>
      );

      // Query all drafts
      const { result } = renderHook(() => useConflictDrafts(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.drafts).toHaveLength(2);
      // Ensure use case was not called because db is available
      expect(mockGetConflictDrafts.execute).not.toHaveBeenCalled();

      // Reactive update: add draft3
      await act(async () => {
        await testDb.conflictDrafts.put({
          id: 'draft-live-3',
          documentId: 'doc-live-3',
          baseVersion: 1,
          serverVersion: 2,
          localContent: '# Live Local 3',
          serverContent: '# Live Server 3',
          createdAt: '2026-10-18T10:10:00.000Z',
        });
      });

      await waitFor(() => {
        expect(result.current.drafts).toHaveLength(3);
      });
    });

    it('filters drafts by documentId when documentId is specified', async () => {
      await testDb.conflictDrafts.put({
        id: 'draft-live-a',
        documentId: 'doc-target',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Live Target',
        serverContent: '# Live Server Target',
        createdAt: '2026-10-18T10:00:00.000Z',
      });
      await testDb.conflictDrafts.put({
        id: 'draft-live-b',
        documentId: 'doc-other',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Live Other',
        serverContent: '# Live Server Other',
        createdAt: '2026-10-18T10:05:00.000Z',
      });

      const mockContext: any = {
        infrastructure: {
          db: testDb,
        },
        useCases: {
          sync: {
            getConflictDrafts: mockGetConflictDrafts,
            resolveConflictDraft: mockResolveConflictDraft,
          },
        },
      };

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientContext.Provider value={queryClient}>
          <ApplicationContext.Provider value={mockContext}>
            {children}
          </ApplicationContext.Provider>
        </QueryClientContext.Provider>
      );

      const { result } = renderHook(() => useConflictDrafts('doc-target'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.drafts).toHaveLength(1);
      expect(result.current.drafts[0].id).toBe('draft-live-a');
    });
  });
});
