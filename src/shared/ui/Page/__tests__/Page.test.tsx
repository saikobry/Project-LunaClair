import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Page } from '../Page';

describe('Page back navigation', () => {
  it('renders no back button by default', () => {
    render(<Page title="Settings">content</Page>);

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('renders a Back button that fires onBack when provided', () => {
    const onBack = vi.fn();
    render(
      <Page title="Settings" onBack={onBack}>
        content
      </Page>
    );

    const back = screen.getByRole('button', { name: 'Back' });
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('uses backLabel as the accessible name', () => {
    render(
      <Page title="Settings" onBack={() => {}} backLabel="Back to Home">
        content
      </Page>
    );

    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
  });
});
