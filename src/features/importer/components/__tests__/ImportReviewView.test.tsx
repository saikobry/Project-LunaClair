import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ImportReviewView } from '../ImportReviewView';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

// Mock WriterEditor for isolated component testing
vi.mock('../../../writer/components/WriterEditor', () => ({
  WriterEditor: ({ initialMarkdown, onChange }: { initialMarkdown: string; onChange: (md: string) => void }) => (
    <textarea
      data-testid="mock-writer-editor"
      value={initialMarkdown}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock MarkdownViewer for clean snapshot & presence checks
vi.mock('../../../reader/components/MarkdownViewer', () => ({
  default: ({ text }: { text: string }) => (
    <div data-testid="mock-markdown-viewer">{text}</div>
  ),
}));

describe('ImportReviewView', () => {
  let mockCleanupExecute: ReturnType<typeof vi.fn>;

  const mockCandidates: ImportCandidate[] = [
    {
      id: 'cand-1',
      filename: 'cell_bio.pdf',
      source: 'pdf',
      file: new File([''], 'cell_bio.pdf', { type: 'application/pdf' }),
      status: 'review',
      title: 'Cell Biology Notes',
      markdown: '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
    },
    {
      id: 'cand-2',
      filename: 'genetics.pdf',
      source: 'pdf',
      file: new File([''], 'genetics.pdf', { type: 'application/pdf' }),
      status: 'review',
      title: 'Genetics Notes',
      markdown: '# Genetics Notes',
    },
  ];

  beforeEach(() => {
    mockCleanupExecute = vi.fn().mockResolvedValue({
      original: '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
      cleaned: '# Structured Cell Biology\n\n### Key Concepts\n- Fact 1\n- Fact 2',
    });
  });

  function renderWithContext(ui: ReactNode, executeFn = mockCleanupExecute) {
    const mockContextValue = {
      useCases: {
        importer: {
          cleanupWithAi: {
            execute: executeFn,
          },
        },
      },
    } as unknown as ApplicationContextValue;

    return render(
      <ApplicationContext.Provider value={mockContextValue}>
        {ui}
      </ApplicationContext.Provider>,
    );
  }

  it('returns null if candidate at activeIndex is not found', () => {
    const onUpdateMarkdown = vi.fn();
    const { container } = renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={5}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dual-pane review layout with candidate files, editor, and preview', () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('cell_bio.pdf')).toBeInTheDocument();
    expect(screen.getByText('genetics.pdf')).toBeInTheDocument();
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(screen.getByText('Live Rendered Preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ai cleanup/i })).toBeInTheDocument();

    const editor = screen.getByTestId('mock-writer-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('# Raw Cell Bio\n\n- Fact 1\n- Fact 2');
  });

  it('updates markdown when user edits within WriterEditor', () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    const editor = screen.getByTestId('mock-writer-editor');
    fireEvent.change(editor, { target: { value: '# Manually Edited Notes' } });

    expect(onUpdateMarkdown).toHaveBeenCalledWith('cand-1', '# Manually Edited Notes');
  });

  it('triggers AI cleanup and displays diff modal on success', async () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    const cleanupBtn = screen.getByRole('button', { name: /ai cleanup/i });
    fireEvent.click(cleanupBtn);

    await waitFor(() => {
      expect(mockCleanupExecute).toHaveBeenCalledWith(
        '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
        'Cell Biology Notes',
      );
    });

    await waitFor(() => {
      expect(screen.getByText('AI Cleanup Diff Comparison')).toBeInTheDocument();
      expect(screen.getByText('Original Extracted Text')).toBeInTheDocument();
      expect(screen.getByText('AI Cleaned Structure')).toBeInTheDocument();
    });
  });

  it('accepts AI cleanup result, updates editor content, calls onUpdateMarkdown, and closes diff modal', async () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(screen.getByText('Accept AI Cleaned')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /accept ai cleaned/i }));

    await waitFor(() => {
      expect(screen.queryByText('AI Cleanup Diff Comparison')).not.toBeInTheDocument();
    });

    expect(onUpdateMarkdown).toHaveBeenCalledWith(
      'cand-1',
      '# Structured Cell Biology\n\n### Key Concepts\n- Fact 1\n- Fact 2',
    );
  });

  it('rejects AI cleanup result and keeps original without propagating changes', async () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(screen.getByText('Keep Original')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /keep original/i }));

    await waitFor(() => {
      expect(screen.queryByText('AI Cleanup Diff Comparison')).not.toBeInTheDocument();
    });

    // onUpdateMarkdown should not have been called with cleaned text
    expect(onUpdateMarkdown).not.toHaveBeenCalledWith(
      'cand-1',
      '# Structured Cell Biology\n\n### Key Concepts\n- Fact 1\n- Fact 2',
    );
  });

  it('displays error message if AI cleanup fails', async () => {
    const failingExecute = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));
    const onUpdateMarkdown = vi.fn();

    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
      failingExecute,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });
});
