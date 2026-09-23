import { describe, it, expect } from 'vitest';
import { getSelectingAction, firstReviewableIndex } from '../selectingAction';
import type { ImportCandidate } from '../../../../../domain/importer/models/importer.types';

function candidate(id: string, status: ImportCandidate['status']): ImportCandidate {
  return {
    id,
    filename: `${id}.pdf`,
    source: 'pdf',
    file: new File([''], `${id}.pdf`, { type: 'application/pdf' }),
    status,
  };
}

describe('getSelectingAction', () => {
  it('disables the action when no candidate exists yet', () => {
    expect(getSelectingAction([])).toEqual({
      label: 'Start Extraction',
      disabled: true,
      action: 'extract',
    });
  });

  it('starts extraction for a fresh queue', () => {
    expect(getSelectingAction([candidate('a', 'pending'), candidate('b', 'pending')])).toEqual({
      label: 'Start Extraction',
      disabled: false,
      action: 'extract',
    });
  });

  it('extracts only the new files when pending candidates sit beside extracted ones', () => {
    expect(getSelectingAction([candidate('a', 'review'), candidate('b', 'pending')])).toEqual({
      label: 'Extract New Files',
      disabled: false,
      action: 'extract',
    });
  });

  it('returns to review without re-extracting when every candidate is extracted', () => {
    expect(getSelectingAction([candidate('a', 'review'), candidate('b', 'done')])).toEqual({
      label: 'Continue to Review',
      disabled: false,
      action: 'review',
    });
  });

  it('offers a retry when every candidate failed', () => {
    expect(getSelectingAction([candidate('a', 'error'), candidate('b', 'error')])).toEqual({
      label: 'Retry Extraction',
      disabled: false,
      action: 'extract',
    });
  });

  it('locks the action while extraction is in flight', () => {
    expect(getSelectingAction([candidate('a', 'extracting'), candidate('b', 'pending')])).toEqual({
      label: 'Extracting...',
      disabled: true,
      action: 'extract',
    });
  });

  it('prefers extraction while any pending candidate remains, even if some failed', () => {
    expect(getSelectingAction([candidate('a', 'error'), candidate('b', 'pending')]).action).toBe(
      'extract',
    );
  });

  it('returns to review when failures sit beside extracted candidates and nothing is pending', () => {
    expect(getSelectingAction([candidate('a', 'error'), candidate('b', 'review')])).toEqual({
      label: 'Continue to Review',
      disabled: false,
      action: 'review',
    });
  });
});

describe('firstReviewableIndex', () => {
  it('selects the first extracted candidate so Review never opens on an empty editor', () => {
    expect(
      firstReviewableIndex([candidate('a', 'error'), candidate('b', 'done'), candidate('c', 'review')]),
    ).toBe(1);
  });

  it('falls back to the first candidate when nothing is extracted', () => {
    expect(firstReviewableIndex([candidate('a', 'pending')])).toBe(0);
    expect(firstReviewableIndex([])).toBe(0);
  });
});
