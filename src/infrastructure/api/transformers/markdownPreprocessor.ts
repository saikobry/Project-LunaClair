/**
 * Pure markdown transformation utility.
 *
 * Resolves relative figure image URLs (e.g. `images/figure41a.png` or `./images/figure41a.png`)
 * to API endpoints (`/api/documents/{documentId}/figures/{filename}`).
 */
export function preprocessMarkdown(raw: string, documentId: string): string {
    const encodedDocumentId = encodeURIComponent(documentId);
    const baseFigureUrl = `/api/documents/${encodedDocumentId}/figures/`;

    // Matches markdown images with relative src: ![alt](images/filename.png) or ![alt](./images/filename.png)
    return raw.replace(
        /!\[([^\]]*)\]\((?:\.\/)?images\/([^)]+)\)/g,
        (_, alt: string, filename: string) =>
            `![${alt}](${baseFigureUrl}${encodeURIComponent(filename)})`,
    );
}
