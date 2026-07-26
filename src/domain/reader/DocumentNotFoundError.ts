export class DocumentNotFoundError extends Error {
    readonly sourceId: string;

    constructor(sourceId: string) {
        super(`Document not found: ${sourceId}`);
        this.name = 'DocumentNotFoundError';
        this.sourceId = sourceId;
    }
}
