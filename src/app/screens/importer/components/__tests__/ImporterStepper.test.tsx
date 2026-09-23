import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImporterStepper } from '../ImporterStepper';
import type { ImportSession } from '../../../../../domain/importer/models/importer.types';

describe('ImporterStepper', () => {
  it.each<[ImportSession['status'], string, string]>([
    ['selecting', 'Step 1 of 5: Select Files', 'Step 1: Files, current step'],
    ['extracting', 'Step 2 of 5: Extracting Text', 'Step 2: Extract, current step'],
    ['review', 'Step 3 of 5: Review Content', 'Step 3: Review, current step'],
    ['details', 'Step 4 of 5: Material Details', 'Step 4: Details, current step'],
    ['completed', 'Step 5 of 5: Completed', 'Step 5: Completed, current step'],
  ])('renders the %s caption and marks its node current', (status, caption, currentNodeName) => {
    render(<ImporterStepper currentStep={status} />);

    // The caption is the acceptance-suite contract: one element, exact text.
    expect(screen.getByText(caption)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: currentNodeName })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('marks earlier nodes completed and later nodes upcoming', () => {
    render(<ImporterStepper currentStep="review" />);

    expect(screen.getByRole('listitem', { name: 'Step 1: Files, completed' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('listitem', { name: 'Step 2: Extract, completed' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Step 4: Details, upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Step 5: Completed, upcoming' })).toBeInTheDocument();

    // Desktop labels are rendered per step (hidden by CSS on mobile only).
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('reports the transient saving status on Details without a caption of its own', () => {
    render(<ImporterStepper currentStep="saving" />);

    expect(screen.getByRole('listitem', { name: 'Step 4: Details, current step' })).toBeInTheDocument();
    expect(screen.queryByText(/^Step \d of 5:/)).not.toBeInTheDocument();
  });

  it('announces the caption politely as the step changes', () => {
    render(<ImporterStepper currentStep="details" />);

    expect(screen.getByText('Step 4 of 5: Material Details')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('navigation', { name: 'Import progress' })).toBeInTheDocument();
  });
});
