import { describe, it, expect } from 'vitest';
import { computeLineDiff } from '../textDiff';

describe('computeLineDiff', () => {
  it('returns empty diff for empty inputs', () => {
    const result = computeLineDiff('', '');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.unifiedLines).toHaveLength(0);
    expect(result.splitRows).toHaveLength(0);
  });

  it('detects no changes for identical text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = computeLineDiff(text, text);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.unifiedLines).toHaveLength(3);
    expect(result.unifiedLines.every(l => l.type === 'equal')).toBe(true);
    expect(result.splitRows).toHaveLength(3);
  });

  it('detects pure additions', () => {
    const orig = 'Line 1\nLine 3';
    const clean = 'Line 1\nLine 2\nLine 3';
    const result = computeLineDiff(orig, clean);
    expect(result.additions).toBe(1);
    expect(result.deletions).toBe(0);
    const added = result.unifiedLines.find(l => l.type === 'add');
    expect(added?.text).toBe('Line 2');
    expect(added?.cleanedLineNumber).toBe(2);
  });

  it('detects pure deletions', () => {
    const orig = 'Line 1\nRaw OCR Junk\nLine 2';
    const clean = 'Line 1\nLine 2';
    const result = computeLineDiff(orig, clean);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
    const deleted = result.unifiedLines.find(l => l.type === 'delete');
    expect(deleted?.text).toBe('Raw OCR Junk');
    expect(deleted?.originalLineNumber).toBe(2);
  });

  it('detects replaced/modified lines', () => {
    const orig = '# raw heading\nsome bad line';
    const clean = '# Clean Heading\nsome good line';
    const result = computeLineDiff(orig, clean);
    expect(result.deletions).toBe(2);
    expect(result.additions).toBe(2);
  });

  it('handles multiline documents with shared prefix and suffix', () => {
    const orig = 'Title\nIntro\nBad 1\nBad 2\nFooter';
    const clean = 'Title\nIntro\nGood 1\nGood 2\nFooter';
    const result = computeLineDiff(orig, clean);
    expect(result.deletions).toBe(2);
    expect(result.additions).toBe(2);
    expect(result.unifiedLines[0].text).toBe('Title');
    expect(result.unifiedLines[0].type).toBe('equal');
    expect(result.unifiedLines[result.unifiedLines.length - 1].text).toBe('Footer');
    expect(result.unifiedLines[result.unifiedLines.length - 1].type).toBe('equal');
  });
});
