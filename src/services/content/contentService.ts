import type { StudyMaterial } from '../../domain/library';
import type { Document } from '../../domain/reader';

/**
 * Image map for {{FIGUREXXX}} placeholders embedded in markdown content.
 */
const figureImages: Record<string, string> = {
  FIGURE41A: '/figure41a.png',
  FIGURE41B: '/figure41b.png',
  FIGURE41C: '/figure41c.png',
  FIGURE41D: '/figure41d.png',
  FIGURE42: '/figure42.png',
  FIGURE43: '/figure43.png',
  FIGURE44: '/figure44.png',
  FIGURE45: '/figure45.png',
  FIGURE46A: '/figure46a.png',
  FIGURE46B: '/figure46b.png',
  FIGURE47A: '/figure47a.png',
  FIGURE47B: '/figure47b.png',
  FIGURE47C: '/figure47c.png',
  FIGURE47D: '/figure47d.png',
  FIGURE48: '/figure48.png',
  FIGURE49: '/figure49.png',
  FIGURE410A: '/figure410a.png',
  FIGURE410B: '/figure410b.png',
  FIGURE411A: '/figure411a.png',
  FIGURE411B: '/figure411b.png',
  FIGURE411C: '/figure411c.png',
};

/**
 * Replaces {{FIGUREXXX}} placeholders with standard markdown image syntax.
 */
function preprocessMarkdown(raw: string): string {
  let content = raw;
  for (const [key, src] of Object.entries(figureImages)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), `![${key}](${src})`);
  }
  return content;
}

/**
 * Map of known source IDs to their raw markdown content.
 * In a future phase this will be replaced by a proper content store / API.
 */
const contentStore: Record<string, string | undefined> = {};

/**
 * Registers raw markdown content for a given source ID.
 * Called at app startup by bootstrap.
 */
export function registerContent(sourceId: string, rawContent: string): void {
  contentStore[sourceId] = rawContent;
}

export const contentService = {
  async resolveDocument(material: StudyMaterial): Promise<Document> {
    const raw = contentStore[material.sourceId];
    if (raw === undefined) {
      throw new Error(`Unknown sourceId: ${material.sourceId}`);
    }

    return {
      id: material.id,
      title: material.title,
      content: preprocessMarkdown(raw),
      format: 'markdown',
    };
  },
};
