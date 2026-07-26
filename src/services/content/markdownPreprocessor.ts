/**
 * Pure markdown transformation utility.
 *
 * Resolves relative image URLs (e.g. `images/figure41a.png`) to absolute
 * paths based on the material's base directory (`/materials/{sourceId}/`).
 */
export function preprocessMarkdown(raw: string, sourceId: string): string {
    const basePath = `/materials/${sourceId}/`;

    // Resolve relative image paths to absolute URLs
    // Matches markdown images with relative src: ![alt](images/...) or ![alt](./images/...)
    return raw.replace(
        /!\[([^\]]*)\]\((?:\.\/)?(images\/[^)]+)\)/g,
        `![$1](${basePath}$2)`,
    );
}
