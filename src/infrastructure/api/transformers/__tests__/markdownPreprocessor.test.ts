import { describe, it, expect } from 'vitest';
import { preprocessMarkdown } from '../markdownPreprocessor';

describe('preprocessMarkdown', () => {
  it('rewrites relative image paths without leading dot-slash', () => {
    const raw = 'Look at this: ![Figure 1](images/anatomy.png)';
    const result = preprocessMarkdown(raw, 'doc-123');
    expect(result).toBe('Look at this: ![Figure 1](/api/documents/doc-123/figures/anatomy.png)');
  });

  it('rewrites relative image paths with leading dot-slash', () => {
    const raw = 'Look at this: ![Figure 1](./images/anatomy.png)';
    const result = preprocessMarkdown(raw, 'doc-123');
    expect(result).toBe('Look at this: ![Figure 1](/api/documents/doc-123/figures/anatomy.png)');
  });

  it('correctly URL-encodes documentId and filenames with spaces or special characters', () => {
    const raw = '![Cell Division](./images/cell division & mitosis #1.png)';
    const result = preprocessMarkdown(raw, 'doc/special:id?');
    expect(result).toBe(
      '![Cell Division](/api/documents/doc%2Fspecial%3Aid%3F/figures/cell%20division%20%26%20mitosis%20%231.png)',
    );
  });

  it('leaves absolute and non-images URLs untouched', () => {
    const raw = [
      '![Remote Image](https://example.com/images/heart.png)',
      '![Absolute Path](/data/figures/heart.png)',
      '[Regular Link](images/heart.png)',
      'Plain text mentioning images/heart.png without markdown image syntax',
    ].join('\n\n');

    const result = preprocessMarkdown(raw, 'doc-123');
    expect(result).toBe(raw);
  });

  it('transforms multiple images across a markdown document', () => {
    const raw = `
# Cardio System
![SA Node](images/sa_node.png)
Some text.
![AV Node](./images/av_node.jpg)
Conclusion.
    `.trim();

    const result = preprocessMarkdown(raw, 'doc-cardio');
    expect(result).toContain('![SA Node](/api/documents/doc-cardio/figures/sa_node.png)');
    expect(result).toContain('![AV Node](/api/documents/doc-cardio/figures/av_node.jpg)');
  });
});
