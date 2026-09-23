import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportReviewView } from '../ImportReviewView';
import { ApplicationContext, type ApplicationContextValue } from '../../../../app/providers/ApplicationContext';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';
import type { AiModelCatalog } from '../../../../domain/ai/services/aiModelCatalog';
import { DEFAULT_AI_MODEL_CATALOG } from '../../../../domain/ai/services/aiModelCatalog';
import { InMemoryPreferencesRepository } from '../../../../test/mocks/inMemoryPreferencesRepository';
import { SetPreferredModelIdUseCase } from '../../../../application/use-cases/ai/SetPreferredModelIdUseCase';

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
  let queryClient: QueryClient;
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
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockCleanupExecute = vi.fn().mockResolvedValue({
      original: '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
      cleaned: '# Structured Cell Biology\n\n### Key Concepts\n- Fact 1\n- Fact 2',
    });
  });

  function renderWithContext(
    ui: ReactNode,
    executeFn = mockCleanupExecute,
    catalogOverride?: () => Promise<AiModelCatalog>,
  ) {
    const preferences = new InMemoryPreferencesRepository();
    const mockContextValue = {
      repositories: { preferences },
      useCases: {
        importer: {
          cleanupWithAi: {
            execute: executeFn,
          },
        },
        ai: {
          setPreferredModelId: new SetPreferredModelIdUseCase(preferences),
          ...(catalogOverride ? { getModelCatalog: { execute: catalogOverride } } : {}),
        },
      },
    } as unknown as ApplicationContextValue;

    return render(
      <QueryClientProvider client={queryClient}>
        <ApplicationContext.Provider value={mockContextValue}>
          {ui}
        </ApplicationContext.Provider>
      </QueryClientProvider>,
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

  it('renders the split review layout with the toolbar file selector, editor, and preview', () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    // The 220px sidebar is gone: every pixel of the body goes to the panes.
    expect(screen.queryByRole('heading', { name: 'Files' })).not.toBeInTheDocument();
    // Only the active filename is in the DOM while the selector is closed.
    expect(screen.getAllByText('cell_bio.pdf')).toHaveLength(1);
    expect(screen.queryByText('genetics.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\(1 of 2\)/ })).toBeInTheDocument();
    expect(screen.getByText('Edit Content')).toBeInTheDocument();
    expect(screen.getByText('Live Rendered Preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ai cleanup/i })).toBeInTheDocument();

    const editor = screen.getByTestId('mock-writer-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('# Raw Cell Bio\n\n- Fact 1\n- Fact 2');
  });

  it('renders a static filename without a selector when there is only one candidate', () => {
    renderWithContext(
      <ImportReviewView
        candidates={[mockCandidates[0]]}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
      />,
    );

    expect(screen.getByText('cell_bio.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /of 1\)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the toolbar file selector, lists every candidate, and selects one', () => {
    const onSelectCandidate = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
        onSelectCandidate={onSelectCandidate}
      />,
    );

    const trigger = screen.getByRole('button', { name: /\(1 of 2\)/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    const listbox = screen.getByRole('listbox', { name: 'Select file to review' });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /cell_bio\.pdf/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: /genetics\.pdf/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('option', { name: /genetics\.pdf/ }));

    expect(onSelectCandidate).toHaveBeenCalledWith(1);
    // The popover closes itself once a file is picked.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getAllByText('cell_bio.pdf')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /\(1 of 2\)/ })).toHaveFocus();
  });

  it('dismisses the file selector on an outside pointerdown', () => {
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
        onSelectCandidate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\(1 of 2\)/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dismisses the file selector on Escape and returns focus to the trigger', () => {
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
        onSelectCandidate={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /\(1 of 2\)/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps the file selector open while interacting inside the popover', () => {
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
        onSelectCandidate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\(1 of 2\)/ }));
    const listbox = screen.getByRole('listbox');

    fireEvent.pointerDown(listbox);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('switches between Split, Editor, and Preview without unmounting the switcher', () => {
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.queryByTestId('mock-writer-editor')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-markdown-viewer')).toBeInTheDocument();
    // The switcher lives above the panes, so it survives leaving Split.
    expect(screen.getByRole('radio', { name: 'Editor' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Editor' }));
    expect(screen.getByTestId('mock-writer-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-markdown-viewer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Split' }));
    expect(screen.getByTestId('mock-writer-editor')).toBeInTheDocument();
    expect(screen.getByTestId('mock-markdown-viewer')).toBeInTheDocument();
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
        expect.objectContaining({
          markdown: '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
          title: 'Cell Biology Notes',
        }),
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

  it('does not apply cleanup if markdown was modified after cleanup started (stale-result guard)', async () => {
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

    // Simulate user editing markdown while AI was generating or waiting to accept
    const editor = screen.getByTestId('mock-writer-editor');
    fireEvent.change(editor, { target: { value: '# Newer User Edits' } });

    // Click Accept AI Cleaned
    fireEvent.click(screen.getByRole('button', { name: /accept ai cleaned/i }));

    await waitFor(() => {
      expect(screen.queryByText('AI Cleanup Diff Comparison')).not.toBeInTheDocument();
    });

    // onUpdateMarkdown should NOT have been called with the stale AI-cleaned text
    expect(onUpdateMarkdown).not.toHaveBeenCalledWith(
      'cand-1',
      '# Structured Cell Biology\n\n### Key Concepts\n- Fact 1\n- Fact 2',
    );
  });

  it('disables AI cleanup button when AI is disabled in catalog', async () => {
    const disabledCatalog: AiModelCatalog = {
      ...DEFAULT_AI_MODEL_CATALOG,
      availability: 'disabled',
      defaultModelId: null,
      models: [],
    };

    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
      />,
      mockCleanupExecute,
      async () => disabledCatalog,
    );

    await waitFor(() => {
      const cleanupBtn = screen.getByRole('button', { name: /ai cleanup/i });
      expect(cleanupBtn).toBeDisabled();
    });
  });

  it('renders model picker in toolbar and forwards selected model to cleanWithAi', async () => {
    const onUpdateMarkdown = vi.fn();
    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={onUpdateMarkdown}
      />,
    );

    // Default catalog offers 2 models (Standard and MAX)
    expect(screen.getByRole('radio', { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /max/i })).toBeInTheDocument();

    // Select MAX model
    fireEvent.click(screen.getByRole('radio', { name: /max/i }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /max/i })).toHaveAttribute('aria-checked', 'true');
    });

    // Trigger AI cleanup
    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(mockCleanupExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          markdown: '# Raw Cell Bio\n\n- Fact 1\n- Fact 2',
          title: 'Cell Biology Notes',
          model: 'ukisai-swift-max',
          catalog: expect.objectContaining({
            defaultModelId: expect.any(String),
            models: expect.any(Array),
          }),
        }),
      );
    });
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

  it('aborts in-flight cleanup and resets editor when candidate switches', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockCleanupExecute.mockImplementation(({ signal }) => {
      capturedSignal = signal;
      return new Promise(() => {}); // never resolves
    });

    function TestCandidateSwitcher() {
      const [activeIndex, setActiveIndex] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setActiveIndex(1)}>
            Switch to Candidate 2
          </button>
          <ImportReviewView
            candidates={mockCandidates}
            activeIndex={activeIndex}
            onUpdateMarkdown={vi.fn()}
          />
        </div>
      );
    }

    renderWithContext(<TestCandidateSwitcher />);

    // Start cleanup on candidate 0
    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));
    expect(screen.getByText('Cleaning with AI...')).toBeInTheDocument();
    expect(capturedSignal?.aborted).toBe(false);

    // Switch candidate
    fireEvent.click(screen.getByRole('button', { name: /switch to candidate 2/i }));

    // In-flight request is aborted and button returns to idle
    expect(capturedSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(screen.queryByText('Cleaning with AI...')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ai cleanup/i })).toBeInTheDocument();
    });

    // Content is updated to Candidate 2's markdown
    const editor = screen.getByTestId('mock-writer-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('# Genetics Notes');
  });

  it('clears active diff modal when candidate switches', async () => {
    function TestCandidateSwitcher() {
      const [activeIndex, setActiveIndex] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setActiveIndex(1)}>
            Switch to Candidate 2
          </button>
          <ImportReviewView
            candidates={mockCandidates}
            activeIndex={activeIndex}
            onUpdateMarkdown={vi.fn()}
          />
        </div>
      );
    }

    renderWithContext(<TestCandidateSwitcher />);

    // Open diff modal on candidate 0
    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));
    await waitFor(() => {
      expect(screen.getByText('AI Cleanup Diff Comparison')).toBeInTheDocument();
    });

    // Switch candidate
    fireEvent.click(screen.getByRole('button', { name: /switch to candidate 2/i }));

    // Diff modal is closed
    await waitFor(() => {
      expect(screen.queryByText('AI Cleanup Diff Comparison')).not.toBeInTheDocument();
    });
  });

  it('disables AI cleanup button and shows countdown when cooldown is active', async () => {
    const rateLimitError = Object.assign(new Error('Rate limited: please try again in 12s'), {
      retryAfterSeconds: 12,
    });
    const failingExecute = vi.fn().mockRejectedValue(rateLimitError);

    renderWithContext(
      <ImportReviewView
        candidates={mockCandidates}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
      />,
      failingExecute,
    );

    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(screen.getByText(/Rate limited: please try again in 12s/i)).toBeInTheDocument();
    });

    // Button is disabled and displays countdown
    const cleanupBtn = screen.getByRole('button', { name: /ai cleanup \(12s\)/i });
    expect(cleanupBtn).toBeDisabled();

    // Model picker displays cooldown notice
    expect(screen.getByText(/Shared capacity is busy — try again in 12s/i)).toBeInTheDocument();
  });

  it('rejects cleanup and does not apply changes if diff candidateId does not match active candidate', async () => {
    const onUpdateMarkdown = vi.fn();

    // We render candidate 0 and generate diff
    function StaleCandidateTest() {
      const [activeIndex, setActiveIndex] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setActiveIndex(1)}>
            Direct Switch
          </button>
          <ImportReviewView
            candidates={mockCandidates}
            activeIndex={activeIndex}
            onUpdateMarkdown={onUpdateMarkdown}
          />
        </div>
      );
    }

    renderWithContext(<StaleCandidateTest />);

    fireEvent.click(screen.getByRole('button', { name: /ai cleanup/i }));

    await waitFor(() => {
      expect(screen.getByText('Accept AI Cleaned')).toBeInTheDocument();
    });

    // Directly change candidate index without letting diff apply
    fireEvent.click(screen.getByRole('button', { name: /direct switch/i }));

    // In-flight/open diff was cleared so Accept AI Cleaned is not present
    expect(screen.queryByText('Accept AI Cleaned')).not.toBeInTheDocument();
    expect(onUpdateMarkdown).not.toHaveBeenCalledWith(
      'cand-2',
      expect.stringContaining('Structured Cell Biology'),
    );
  });

  it('displays warning banner when active candidate extraction is partial', () => {
    const partialCandidate: ImportCandidate = {
      ...mockCandidates[0],
      extraction: {
        text: 'Partial text',
        pageCount: 5,
        pages: [
          { pageNumber: 1, text: 'Page 1', confidence: 95, source: 'ai-vision' },
          { pageNumber: 2, text: 'Page 2', confidence: 95, source: 'ai-vision' },
        ],
        stats: {
          wordCount: 10,
          characterCount: 50,
          headingsDetected: 1,
          ocrPages: 0,
          textPages: 2,
        },
        isPartial: true,
      },
    };

    renderWithContext(
      <ImportReviewView
        candidates={[partialCandidate]}
        activeIndex={0}
        onUpdateMarkdown={vi.fn()}
      />,
    );

    const banner = screen.getByTestId('partial-extraction-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Extraction was cancelled before completion/i);
    expect(banner).toHaveTextContent(/Displaying partial content \(2 of 5 pages\)/i);
  });
});
