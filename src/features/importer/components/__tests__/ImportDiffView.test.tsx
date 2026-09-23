import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDiffView } from '../ImportDiffView';
import * as mediaQueryModule from '../../../../shared/hooks/useMediaQuery';

vi.mock('../../../../shared/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

describe('ImportDiffView', () => {
  const mockDiffResult = {
    candidateId: 'cand-1',
    original: 'Line 1\nLine 2 original\nLine 3',
    cleaned: 'Line 1\nLine 2 cleaned\nLine 3',
  };

  const defaultProps = {
    diffResult: mockDiffResult,
    onReject: vi.fn(),
    onAccept: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mediaQueryModule.useMediaQuery).mockReturnValue(false); // default: desktop
  });

  it('renders split diff by default on desktop with statistics and panes', () => {
    render(<ImportDiffView {...defaultProps} />);

    expect(screen.getByText('AI Cleanup Diff Comparison')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();

    expect(screen.getByText('Original Extracted Text')).toBeInTheDocument();
    expect(screen.getByText('AI Cleaned Structure')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Split Diff/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Unified Diff/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Preview/i })).toBeInTheDocument();
  });

  it('switches between diff display modes on desktop', () => {
    render(<ImportDiffView {...defaultProps} />);

    // Switch to unified diff
    fireEvent.click(screen.getByRole('radio', { name: /Unified Diff/i }));
    expect(
      screen.getByText('Original Extracted Text ➔ AI Cleaned Structure'),
    ).toBeInTheDocument();

    // Switch to preview mode
    fireEvent.click(screen.getByRole('radio', { name: /Preview/i }));
    expect(screen.getAllByText('Original Extracted Text').length).toBeGreaterThan(0);
  });

  it('falls back to unified diff automatically on mobile without rendering a blank screen', () => {
    vi.mocked(mediaQueryModule.useMediaQuery).mockReturnValue(true); // mobile viewport

    render(<ImportDiffView {...defaultProps} />);

    // Split diff option is not present on mobile
    expect(screen.queryByRole('radio', { name: /Split Diff/i })).not.toBeInTheDocument();
    // Unified diff and Preview are available
    expect(screen.getByRole('radio', { name: /Unified Diff/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Preview/i })).toBeInTheDocument();

    // Unified diff content is automatically rendered (not blank!)
    expect(
      screen.getByText('Original Extracted Text ➔ AI Cleaned Structure'),
    ).toBeInTheDocument();
  });

  it('calls onReject when Keep Original is clicked', () => {
    render(<ImportDiffView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Keep Original/i }));
    expect(defaultProps.onReject).toHaveBeenCalledTimes(1);
    expect(defaultProps.onAccept).not.toHaveBeenCalled();
  });

  it('calls onAccept when Accept AI Cleaned is clicked', () => {
    render(<ImportDiffView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Accept AI Cleaned/i }));
    expect(defaultProps.onAccept).toHaveBeenCalledTimes(1);
    expect(defaultProps.onReject).not.toHaveBeenCalled();
  });
});
