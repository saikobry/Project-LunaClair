export const readerQueryKeys = {
    all: ['reader'] as const,
    document: (materialId: string) => [...readerQueryKeys.all, 'document', materialId] as const,
    assets: (materialId: string) => [...readerQueryKeys.all, 'assets', materialId] as const,
    highlights: (documentId: string) => [...readerQueryKeys.all, 'highlights', documentId] as const,
    drawings: (documentId: string) => [...readerQueryKeys.all, 'drawings', documentId] as const,
};
