import { describe, it, expect } from 'vitest';
import { workspaceBreadcrumbs } from '../workspaceBreadcrumbs';

describe('workspaceBreadcrumbs', () => {
  it('renders the two-level path when the material was not opened from a collection', () => {
    expect(workspaceBreadcrumbs('Kinematics', null)).toEqual([
      { label: 'Library', target: { kind: 'library' } },
      { label: 'Kinematics' },
    ]);
  });

  it('inserts the origin collection between Library and the material', () => {
    expect(workspaceBreadcrumbs('Kinematics', { id: 'c-1', title: 'Physics Playlist' })).toEqual([
      { label: 'Library', target: { kind: 'library' } },
      { label: 'Physics Playlist', target: { kind: 'collection', collectionId: 'c-1' } },
      { label: 'Kinematics' },
    ]);
  });

  it('leaves the material crumb as the current page (no target)', () => {
    const crumbs = workspaceBreadcrumbs('Kinematics', { id: 'c-1', title: 'Physics Playlist' });
    expect(crumbs[crumbs.length - 1]).toEqual({ label: 'Kinematics' });
    expect(crumbs.every((crumb, index) => index === crumbs.length - 1 || !!crumb.target)).toBe(true);
  });
});
