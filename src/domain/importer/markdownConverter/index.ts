import type { PageExtraction } from '../importer.types';
import { runNormalizationPass } from './normalizationPass';
import { runPageAnchorPass } from './pageAnchorPass';
import { runStructurePass } from './structurePass';
import { runListPass } from './listPass';
import { runTablePass } from './tablePass';
import { runCleanupPass } from './cleanupPass';

export interface ConvertOptions {
  /** Document title (used for H1) */
  title?: string;
  /** Include page anchor headers (## Page N + ---) */
  includePageAnchors?: boolean;
}

/** Converts page extractions into clean Markdown */
export function convertToMarkdown(pages: PageExtraction[], options?: ConvertOptions): string {
  const includePageAnchors = options?.includePageAnchors ?? true;

  // 1. Join pages with page anchors (if enabled, default true)
  let text = runPageAnchorPass(pages, includePageAnchors);

  // 2. Run normalization pass
  text = runNormalizationPass(text);

  // 3. Run structure detection pass
  text = runStructurePass(text);

  // 4. Run list detection pass
  text = runListPass(text);

  // 5. Run table detection pass
  text = runTablePass(text);

  // 6. Run cleanup pass
  text = runCleanupPass(text);

  // 7. Prepend title as H1 if provided
  if (options?.title) {
    text = `# ${options.title}\n\n${text}`;
  }

  return text;
}
