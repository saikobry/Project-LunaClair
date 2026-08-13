/**
 * Pure markdown transformation utility.
 *
 * Resolves relative figure image URLs (e.g. `images/figure41a.png` or `./images/figure41a.png`)
 * to API endpoints (`/api/documents/{sourceId}/figures/{filename}`).
 */
export function preprocessMarkdown(raw: string, sourceId: string): string {
    const encodedSourceId = encodeURIComponent(sourceId);
    const baseFigureUrl = `/api/documents/${encodedSourceId}/figures/`;

    // Matches markdown images with relative src: ![alt](images/filename.png) or ![alt](./images/filename.png)
    return raw.replace(
        /!\[([^\]]*)\]\((?:\.\/)?images\/([^)]+)\)/g,
        (_, alt: string, filename: string) =>
            `![${alt}](${baseFigureUrl}${encodeURIComponent(filename)})`,
    );
}

