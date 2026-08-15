export class DocumentNotFoundError extends Error {
    readonly documentId: string;

    constructor(documentId: string) {
        super(`Document not found: ${documentId}`);
        this.name = 'DocumentNotFoundError';
        this.documentId = documentId;
    }
}
