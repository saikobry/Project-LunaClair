import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportStatusBadge } from '../ImportStatusBadge';
import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

type CandidateStatus = ImportCandidate['status'];

describe('ImportStatusBadge', () => {
  it.each<CandidateStatus>(['pending', 'review', 'done', 'error'])(
    'renders the %s label with its state dot',
    (status) => {
      const { container } = render(<ImportStatusBadge status={status} />);

      expect(screen.getByText(status)).toBeInTheDocument();
      // Dot only — the label carries the state, so colour is never the sole cue.
      expect(container.querySelectorAll('span')).toHaveLength(2);
      expect(container.querySelector('svg')).toBeNull();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );

  it.each<CandidateStatus>(['extracting', 'saving'])(
    'renders the %s label as a live status with a spinner instead of a dot',
    (status) => {
      const { container } = render(<ImportStatusBadge status={status} />);

      expect(screen.getByText(status)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(status);
      expect(container.querySelector('svg')).not.toBeNull();
      // A spinner replaces the dot rather than joining it.
      expect(container.querySelectorAll('span')).toHaveLength(1);
    },
  );

  it('marks the decoration as decorative', () => {
    const { container } = render(<ImportStatusBadge status="done" />);

    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });
});
