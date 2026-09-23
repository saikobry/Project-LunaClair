import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders progress bar with default ARIA attributes and 50% fill', () => {
    const { container } = render(<ProgressBar value={50} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-label', 'Progress');

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('50%');
  });

  it('respects custom label and max attributes', () => {
    const { container } = render(
      <ProgressBar value={25} max={50} label="Quiz completion" />,
    );

    const progressbar = screen.getByRole('progressbar', { name: 'Quiz completion' });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '25');
    expect(progressbar).toHaveAttribute('aria-valuemax', '50');

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.width).toBe('50%');
  });

  describe('percentage clamping (0-100)', () => {
    it('clamps negative values to 0% width', () => {
      const { container } = render(<ProgressBar value={-20} />);
      const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
      expect(fill.style.width).toBe('0%');
    });

    it('clamps values above max to 100% width', () => {
      const { container } = render(<ProgressBar value={150} max={100} />);
      const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
      expect(fill.style.width).toBe('100%');
    });

    it('renders 0% for zero value', () => {
      const { container } = render(<ProgressBar value={0} />);
      const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
      expect(fill.style.width).toBe('0%');
    });

    it('renders 100% for value equal to max', () => {
      const { container } = render(<ProgressBar value={75} max={75} />);
      const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
      expect(fill.style.width).toBe('100%');
    });

    it('falls back safely when max is zero or negative', () => {
      const { container } = render(<ProgressBar value={50} max={0} />);
      const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
      // safeMax defaults to 100, so 50/100 = 50%
      expect(fill.style.width).toBe('50%');
    });
  });

  it('renders size and variant configurations without error', () => {
    const { rerender } = render(
      <ProgressBar value={40} size="sm" variant="success" />,
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    rerender(<ProgressBar value={40} size="md" variant="warning" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    rerender(<ProgressBar value={40} variant="accent" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('applies custom className to the progress bar container', () => {
    render(<ProgressBar value={30} className="custom-progress-class" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.className).toContain('custom-progress-class');
  });
});
