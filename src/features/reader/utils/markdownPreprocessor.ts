import images from '../assets/images';

/**
 * Replaces {{FIGUREXXX}} placeholders in raw markdown with standard
 * markdown image syntax `![alt](url)`, avoiding raw HTML entirely.
 */
export function preprocessMarkdown(raw: string): string {
  let content = raw;
  for (const [key, src] of Object.entries(images)) {
    content = content.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      `![${key}](${src})`,
    );
  }
  return content;
}
