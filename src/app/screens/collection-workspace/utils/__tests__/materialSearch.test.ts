import { describe, it, expect } from 'vitest';
import { matchesSearch } from '../materialSearch';
import type { StudyMaterial } from '../../../../../domain/library/models/StudyMaterial';

const material = (overrides: Partial<StudyMaterial> = {}): StudyMaterial => ({
  id: 'm-1',
  title: 'Classical Mechanics',
  documentId: 'doc-1',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

describe('matchesSearch', () => {
  it('matches everything on an empty term', () => {
    expect(matchesSearch(material(), '')).toBe(true);
    expect(matchesSearch(material({ tags: [] }), '')).toBe(true);
    expect(matchesSearch(material({ tags: undefined }), '')).toBe(true);
  });

  it('matches a title substring', () => {
    expect(matchesSearch(material(), 'mechanics')).toBe(true);
    expect(matchesSearch(material(), 'classical')).toBe(true);
  });

  it('matches a tag substring', () => {
    expect(matchesSearch(material({ tags: ['physics', 'motion'] }), 'motion')).toBe(true);
    expect(matchesSearch(material({ tags: ['physics'] }), 'phys')).toBe(true);
  });

  it('does not match an absent title or tag', () => {
    expect(matchesSearch(material({ tags: ['physics'] }), 'chemistry')).toBe(false);
  });

  it('handles materials without tags', () => {
    expect(matchesSearch(material({ tags: undefined }), 'mechanics')).toBe(true);
    expect(matchesSearch(material({ tags: undefined }), 'physics')).toBe(false);
  });

  it('expects an already lower-cased term', () => {
    // The drawer lower-cases once per render rather than once per row, so the
    // predicate is intentionally not case-insensitive on the term itself.
    expect(matchesSearch(material(), 'MECHANICS')).toBe(false);
    expect(matchesSearch(material(), 'mechanics')).toBe(true);
  });
});
