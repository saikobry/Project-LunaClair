import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';
import { imagesAndLinksFixtures } from '../fixtures/synthetic/images-and-links';

describe('Image & Link Transformers', () => {
  it('imports markdown image syntax into ImageNode with alt and src', () => {
    const md = imagesAndLinksFixtures.simpleImage;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const paragraph = ast.children?.[0];
    const imageNode = paragraph?.children?.find((node) => node.type === 'image');

    expect(imageNode).toBeDefined();
    expect(imageNode?.props?.altText).toBe('Cell Diagram');
    expect(imageNode?.props?.src).toBe('images/figure-cell.png');
  });

  it('exports ImageNode back into standard markdown syntax', () => {
    const md = imagesAndLinksFixtures.simpleImage;
    const editor = markdownToLexical(md);
    const exported = lexicalToMarkdown(editor);

    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(md));
  });

  it('imports markdown links into LinkNode with target url', () => {
    const md = imagesAndLinksFixtures.simpleLink;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const paragraph = ast.children?.[0];
    const linkNode = paragraph?.children?.find((node) => node.type === 'link');

    expect(linkNode).toBeDefined();
    expect(linkNode?.props?.url).toBe('https://lunaclair.app/docs');
  });

  it('round-trips multiple links within a paragraph', () => {
    const md = imagesAndLinksFixtures.multipleLinks;
    const editor = markdownToLexical(md);
    const exported = lexicalToMarkdown(editor);

    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(md));
  });
});
