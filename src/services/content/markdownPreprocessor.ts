/**
 * Legacy figure placeholder map.
 * Handles {{FIGUREXXX}} placeholders that may still exist in older content.
 */
// TODO(v1.0): Remove legacy figure placeholder support after stable release.
const LEGACY_FIGURE_MAP: Record<string, string> = {
    FIGURE41A: 'images/figure41a.png',
    FIGURE41B: 'images/figure41b.png',
    FIGURE41C: 'images/figure41c.png',
    FIGURE41D: 'images/figure41d.png',
    FIGURE42: 'images/figure42.png',
    FIGURE43: 'images/figure43.png',
    FIGURE44: 'images/figure44.png',
    FIGURE45: 'images/figure45.png',
    FIGURE46A: 'images/figure46a.png',
    FIGURE46B: 'images/figure46b.png',
    FIGURE47A: 'images/figure47a.png',
    FIGURE47B: 'images/figure47b.png',
    FIGURE47C: 'images/figure47c.png',
    FIGURE47D: 'images/figure47d.png',
    FIGURE48: 'images/figure48.png',
    FIGURE49: 'images/figure49.png',
    FIGURE410A: 'images/figure410a.png',
    FIGURE410B: 'images/figure410b.png',
    FIGURE411A: 'images/figure411a.png',
    FIGURE411B: 'images/figure411b.png',
    FIGURE411C: 'images/figure411c.png',
};

/**
 * Pure markdown transformation utility.
 *
 * 1. Resolves relative image URLs (e.g. `images/figure41a.png`) to absolute
 *    paths based on the material's base directory (`/materials/{sourceId}/`).
 * 2. Replaces legacy `{{FIGUREXXX}}` placeholders with resolved image references.
 */
export function preprocessMarkdown(raw: string, sourceId: string): string {
    const basePath = `/materials/${sourceId}/`;

    // Replace legacy {{FIGUREXXX}} placeholders with relative image paths
    // TODO(v1.0): Remove legacy figure placeholder support after stable release.
    let content = raw;
    for (const [key, relativePath] of Object.entries(LEGACY_FIGURE_MAP)) {
        content = content.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            `![](${relativePath})`,
        );
    }

    // Resolve relative image paths to absolute URLs
    // Matches markdown images with relative src: ![alt](images/...) or ![alt](./images/...)
    content = content.replace(
        /!\[([^\]]*)\]\((?:\.\/)?(images\/[^)]+)\)/g,
        `![$1](${basePath}$2)`,
    );

    return content;
}
