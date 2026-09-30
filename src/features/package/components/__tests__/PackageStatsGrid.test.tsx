import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PackageStatsGrid } from '../PackageStatsGrid';
import { QuestionTypeBreakdown } from '../QuestionTypeBreakdown';
import { formatPackageDate, formatQuestionType } from '../../utils/packageFormat';
import type { StudyPackageSummary } from '../../../../domain/package/models/package.types';

const summary: StudyPackageSummary = {
  title: 'Neurobiology Essentials',
  description: 'Overview',
  author: 'Dr. Santiago',
  createdAt: '2026-08-28T00:00:00.000Z',
  tags: ['neuroscience'],
  materialCount: 1,
  questionCount: 2,
  quizCount: 1,
  assetCount: 1,
  questionsByType: { multiple_choice: 1, true_false: 1 },
  totalPoints: 15,
};

describe('PackageStatsGrid', () => {
  it('renders all five package metrics from a pre-fetched summary', () => {
    render(<PackageStatsGrid summary={summary} />);

    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Quizzes')).toBeInTheDocument();
    expect(screen.queryByText('Flashcards')).not.toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Total Points')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});

describe('QuestionTypeBreakdown', () => {
  it('renders formatted type badges in card chrome by default', () => {
    render(<QuestionTypeBreakdown entries={Object.entries(summary.questionsByType)} />);

    expect(screen.getByText('Question Types')).toBeInTheDocument();
    expect(screen.getByText(/Multiple Choice/)).toBeInTheDocument();
    expect(screen.getByText(/True \/ False/)).toBeInTheDocument();
  });

  it('renders the chrome-less section for the preview modal', () => {
    render(<QuestionTypeBreakdown entries={Object.entries(summary.questionsByType)} chrome="none" />);

    expect(screen.getByText('Question Types')).toBeInTheDocument();
    expect(screen.getByText(/Multiple Choice/)).toBeInTheDocument();
  });

  it('renders nothing for an empty question-type list', () => {
    const { container } = render(<QuestionTypeBreakdown entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('packageFormat', () => {
  it('canonicalizes question-type labels and package dates', () => {
    expect(formatQuestionType('multiple_choice')).toBe('Multiple Choice');
    expect(formatQuestionType('true_false')).toBe('True / False');
    expect(formatQuestionType('custom_type')).toBe('custom type');
    expect(formatPackageDate('2026-08-28T00:00:00.000Z')).toMatch(/2026/);
    expect(formatPackageDate('not-a-date')).toBe('not-a-date');
    expect(formatPackageDate(undefined)).toBe('');
  });
});
