import { describe, it, expect } from 'vitest';
import { deriveSessionTitle } from '../deriveSessionTitle';

describe('deriveSessionTitle', () => {
  it('keeps a short prompt as the title', () => {
    expect(deriveSessionTitle('What is the cardiac cycle?')).toBe('What is the cardiac cycle?');
  });

  it('collapses whitespace so multi-line prompts stay one line', () => {
    expect(deriveSessionTitle('  Explain\n\n  mitosis   simply ')).toBe('Explain mitosis simply');
  });

  it('truncates a long prompt and does not leave a trailing space before the ellipsis', () => {
    const prompt = `${'a'.repeat(58)} ${'b'.repeat(40)}`;
    const title = deriveSessionTitle(prompt);

    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).not.toContain(' …');
  });

  it('returns an empty string for a blank prompt', () => {
    expect(deriveSessionTitle('   \n  ')).toBe('');
  });
});
