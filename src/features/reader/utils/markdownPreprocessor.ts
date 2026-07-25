import images from '../assets/images';

/**
 * Replaces {{FIGUREXXX}} placeholders in raw markdown with inline <img> tags.
 */
export function preprocessMarkdown(raw: string): string {
  let content = raw;
  for (const [key, src] of Object.entries(images)) {
    content = content.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      `<img src="${src}" alt="${key}" style="max-width:100%" />`,
    );
  }
  return content;
}
