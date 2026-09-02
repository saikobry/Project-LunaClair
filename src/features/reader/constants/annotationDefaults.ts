import type { HighlightColor } from '../../../domain/reader/models/annotation.types';

export const BRUSH_COLORS: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Black', hex: '#1f2937' },
];

export const THICKNESS_OPTIONS = [2, 4, 8, 12] as const;

export const HIGHLIGHT_COLORS: { name: HighlightColor; hex: string; label: string }[] = [
  { name: 'yellow', hex: '#fef08a', label: 'Yellow' },
  { name: 'green', hex: '#bbf7d0', label: 'Green' },
  { name: 'pink', hex: '#fbcfe8', label: 'Pink' },
  { name: 'blue', hex: '#bfdbfe', label: 'Blue' },
];
