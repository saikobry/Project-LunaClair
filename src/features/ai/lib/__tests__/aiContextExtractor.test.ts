import { describe, it, expect } from 'vitest';
import { extractSectionContext } from '../aiContextExtractor';

describe('aiContextExtractor', () => {
  const sampleMarkdown = `
# Biology 101: Cell Biology

## 1. Introduction to the Cell
All living organisms are made of cells. The cell theory is fundamental to biology.

## 2. Cardiac Conduction System
The heart has an intrinsic conduction system that coordinates cardiac contraction.
The SA node initiates each cardiac cycle by generating spontaneous action potentials.
The AV node delays the impulse to allow ventricular filling.

## 3. Cellular Respiration
Cellular respiration breaks down glucose to yield ATP.
`.trim();

  it('extracts containing section and heading when selection exists', () => {
    const selection = 'The SA node initiates each cardiac cycle';
    const result = extractSectionContext(sampleMarkdown, selection);

    expect(result.sectionHeading).toBe('2. Cardiac Conduction System');
    expect(result.contextText).toContain('Section: 2. Cardiac Conduction System');
    expect(result.contextText).toContain('The SA node initiates each cardiac cycle');
    expect(result.contextText).toContain('The AV node delays the impulse');
  });

  it('handles selections without explicit markdown headings gracefully', () => {
    const noHeadingsDoc = 'Single paragraph text without any markdown headers anywhere.';
    const selection = 'paragraph text';
    const result = extractSectionContext(noHeadingsDoc, selection);

    expect(result.sectionHeading).toBeUndefined();
    expect(result.contextText).toContain('Single paragraph text without any markdown headers anywhere.');
  });

  it('returns whole document when no selection is present up to character limit', () => {
    const result = extractSectionContext(sampleMarkdown);

    expect(result.sectionHeading).toBeUndefined();
    expect(result.contextText).toBe(sampleMarkdown);
  });

  it('truncates document when exceeding maxCharacters budget', () => {
    const longDoc = 'A'.repeat(5000);
    const result = extractSectionContext(longDoc, undefined, { maxCharacters: 1000 });

    expect(result.contextText.length).toBeLessThan(1100);
    expect(result.contextText).toContain('[...content truncated to token budget...]');
  });

  it('handles empty document input safely', () => {
    const result = extractSectionContext('', 'some selection');
    expect(result.contextText).toBe('Selected text: "some selection"');
  });
});
