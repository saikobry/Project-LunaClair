import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertCircle } from 'lucide-react';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders title with default h2 heading level', () => {
    render(<ErrorState title="Document not found" />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Document not found' });
    expect(heading).toBeInTheDocument();
  });

  it('respects custom headingLevel prop (h3, h4)', () => {
    const { rerender } = render(<ErrorState title="Failed to load questions" headingLevel="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Failed to load questions' })).toBeInTheDocument();

    rerender(<ErrorState title="Offline error" headingLevel="h4" />);
    expect(screen.getByRole('heading', { level: 4, name: 'Offline error' })).toBeInTheDocument();
  });

  it('renders detailed description when provided', () => {
    render(
      <ErrorState
        title="Network Error"
        description="The requested resource is unavailable while offline."
      />
    );

    expect(
      screen.getByText('The requested resource is unavailable while offline.')
    ).toBeInTheDocument();
  });

  it('renders error icon with aria-hidden="true"', () => {
    render(
      <ErrorState
        icon={<AlertCircle data-testid="error-icon" />}
        title="Failed to sync"
      />
    );

    const icon = screen.getByTestId('error-icon');
    expect(icon).toBeInTheDocument();
    const iconContainer = icon.closest('div');
    expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders primary and secondary recovery actions', () => {
    render(
      <ErrorState
        title="Something went wrong"
        action={<button type="button">Try Again</button>}
        secondaryAction={<button type="button">Back to Library</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Library' })).toBeInTheDocument();
  });

  it('renders compact size and custom classes/styles correctly', () => {
    const { container } = render(
      <ErrorState
        title="Compact Error"
        size="compact"
        className="custom-error-class"
        style={{ padding: 16 }}
      />
    );

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement.className).toContain('custom-error-class');
    expect(rootElement.style.padding).toBe('16px');
  });
});
