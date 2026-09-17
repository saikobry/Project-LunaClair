import { describe, it, expect } from 'vitest';
import { describeExploreEmptyState } from '../exploreFilters';

describe('describeExploreEmptyState', () => {
  it('treats a query miss as recoverable from the hub', () => {
    expect(describeExploreEmptyState('retrosynthesis')).toEqual({
      title: 'No study packages found',
      description: 'No study packages matched "retrosynthesis".',
      showClear: true,
    });
  });

  it('trims the query before quoting it back', () => {
    expect(describeExploreEmptyState('  cell  ').description).toBe(
      'No study packages matched "cell".',
    );
  });

  it('reports an empty hub without a clear action', () => {
    expect(describeExploreEmptyState(undefined)).toEqual({
      title: 'No study packages found',
      description: 'No study packages have been published yet. Check back soon!',
      showClear: false,
    });
  });

  it('treats a blank query as no query', () => {
    expect(describeExploreEmptyState('   ').showClear).toBe(false);
  });
});
