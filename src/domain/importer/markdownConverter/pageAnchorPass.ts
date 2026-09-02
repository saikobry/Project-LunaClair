import type { PageExtraction } from '../models/importer.types';

/**
 * Given an array of PageExtraction, joins text with page anchors.
 * Single-page documents skip page anchors entirely.
 */
export function runPageAnchorPass(pages: PageExtraction[], includePageAnchors: boolean): string {
  if (pages.length === 0) {
    return '';
  }

  if (pages.length === 1 || !includePageAnchors) {
    return pages.map(p => p.text).join('\n\n');
  }

  return pages
    .map((page, index) => {
      const anchor = index > 0 ? `\n\n---\n\n## Page ${page.pageNumber}\n\n` : `## Page ${page.pageNumber}\n\n`;
      return `${anchor}${page.text}`;
    })
    .join('');
}
