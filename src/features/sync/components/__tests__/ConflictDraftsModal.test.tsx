import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConflictDraftsModal } from '../ConflictDraftsModal';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { ConflictDraft } from '../../../../domain/sync/sync.types';

describe('ConflictDraftsModal', () => {
  const mockDrafts: ConflictDraft[] = [
    {
      id: 'draft-1',
      documentId: 'doc-1',
      baseVersion: 1,
      serverVersion: 2,
      localContent: '# Local Heading\nLocal paragraph',
      serverContent: '# Server Heading\nServer paragraph',
      createdAt: '2026-08-27T10:00:00.000Z',
    },
    {
      id: 'draft-2',
      documentId: 'doc-2',
      baseVersion: 2,
      serverVersion: 3,
      localContent: '# Second Doc Local',
      serverContent: '# Second Doc Server',
      createdAt: '2026-08-27T10:05:00.000Z',
    },
  ];

  let mockGetConflictDrafts: { execute: ReturnType<typeof vi.fn> };
  let mockResolveConflictDraft: { execute: ReturnType<typeof vi.fn> };
  let mockContext: any;

  beforeEach(() => {
    mockGetConflictDrafts = {
      execute: vi.fn().mockResolvedValue([...mockDrafts]),
    };

    mockResolveConflictDraft = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      useCases: {
        sync: {
          getConflictDrafts: mockGetConflictDrafts,
          resolveConflictDraft: mockResolveConflictDraft,
        },
      },
    };
  });

  function renderModal(props: Partial<ComponentProps<typeof ConflictDraftsModal>> = {}) {
    const onClose = vi.fn();
    const result = render(
      <ApplicationContext.Provider value={mockContext}>
        <ConflictDraftsModal
          isOpen={true}
          onClose={onClose}
          {...props}
        />
      </ApplicationContext.Provider>
    );

    return {
      ...result,
      onClose,
    };
  }

  it('does not render when isOpen is false', () => {
    render(
      <ApplicationContext.Provider value={mockContext}>
        <ConflictDraftsModal
          isOpen={false}
          onClose={vi.fn()}
        />
      </ApplicationContext.Provider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders side-by-side diff with server and local contents and version badges', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Server Version (Canonical)')).toBeInTheDocument();
      expect(screen.getByText('Your Local Version (Divergent)')).toBeInTheDocument();
    });

    expect(screen.getByText(/# Server Heading/)).toBeInTheDocument();
    expect(screen.getByText(/# Local Heading/)).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('base v1')).toBeInTheDocument();
  });

  it('resolves draft with keep_server resolution when clicking "Keep Server Version"', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Keep Server Version')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Keep Server Version'));

    await waitFor(() => {
      expect(mockResolveConflictDraft.execute).toHaveBeenCalledWith({
        draftId: 'draft-1',
        resolution: 'keep_server',
        mergedContent: undefined,
      });
    });
  });

  it('resolves draft with keep_local resolution when clicking "Keep My Version"', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Keep My Version')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Keep My Version'));

    await waitFor(() => {
      expect(mockResolveConflictDraft.execute).toHaveBeenCalledWith({
        draftId: 'draft-1',
        resolution: 'keep_local',
        mergedContent: undefined,
      });
    });
  });

  it('allows editing and resolving merged content when clicking "Edit & Merge"', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Edit & Merge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit & Merge'));

    const textarea = screen.getByPlaceholderText(/Combine or edit your document content here/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: '# Custom Merged Heading\nMerged body' } });

    fireEvent.click(screen.getByText('Save Merged Version'));

    await waitFor(() => {
      expect(mockResolveConflictDraft.execute).toHaveBeenCalledWith({
        draftId: 'draft-1',
        resolution: 'merge',
        mergedContent: '# Custom Merged Heading\nMerged body',
      });
    });
  });

  it('navigates between multiple conflict drafts', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Conflict 1 of 2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Next/i));

    await waitFor(() => {
      expect(screen.getByText('Conflict 2 of 2')).toBeInTheDocument();
      expect(screen.getByText(/# Second Doc Server/)).toBeInTheDocument();
      expect(screen.getByText(/# Second Doc Local/)).toBeInTheDocument();
    });
  });

  it('closes modal when last conflict is resolved', async () => {
    mockGetConflictDrafts.execute.mockResolvedValue([mockDrafts[0]]);

    const { onClose } = renderModal();

    await waitFor(() => {
      expect(screen.getByText('Keep Server Version')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Keep Server Version'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
