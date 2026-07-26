export const readerQueryKeys = {
    root: ['reader'] as const,
    document: (materialId: string) => [...readerQueryKeys.root, 'document', materialId] as const,
    highlights: (documentId: string) => [...readerQueryKeys.root, 'highlights', documentId] as const,
    drawings: (documentId: string) => [...readerQueryKeys.root, 'drawings', documentId] as const,
};
