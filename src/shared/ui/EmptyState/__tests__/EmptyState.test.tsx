import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title with default h2 heading level', () => {
    render(<EmptyState title="No materials found" />);

    const heading = screen.getByRole('heading', { level: 2, name: 'No materials found' });
    expect(heading).toBeInTheDocument();
  });

  it('respects custom headingLevel prop (h3, h4)', () => {
    const { rerender } = render(<EmptyState title="No active filters" headingLevel="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: 'No active filters' })).toBeInTheDocument();

    rerender(<EmptyState title="No questions" headingLevel="h4" />);
    expect(screen.getByRole('heading', { level: 4, name: 'No questions' })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="Empty Collection"
        description="Try adjusting your search or add a new material to get started."
      />
    );

    expect(
      screen.getByText('Try adjusting your search or add a new material to get started.')
    ).toBeInTheDocument();
  });

  it('renders icon with aria-hidden="true"', () => {
    render(
      <EmptyState
        icon={<Sparkles data-testid="sparkles-icon" />}
        title="Nothing here yet"
      />
    );

    const icon = screen.getByTestId('sparkles-icon');
    expect(icon).toBeInTheDocument();
    const iconContainer = icon.closest('div');
    expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders primary and secondary action elements', () => {
    render(
      <EmptyState
        title="No items found"
        action={<button type="button">Create Material</button>}
        secondaryAction={<button type="button">Reset Filters</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Create Material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Filters' })).toBeInTheDocument();
  });

  it('renders compact size and custom classes/styles correctly', () => {
    const { container } = render(
      <EmptyState
        title="Compact Empty"
        size="compact"
        className="custom-empty-class"
        style={{ marginTop: 20 }}
      />
    );

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement.className).toContain('custom-empty-class');
    expect(rootElement.style.marginTop).toBe('20px');
  });
});
