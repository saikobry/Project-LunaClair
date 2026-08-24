export const analyticsQueryKeys = {
    all: ['analytics'] as const,
    global: () => [...analyticsQueryKeys.all, 'global'] as const,
    subject: (subjectId: string) => [...analyticsQueryKeys.all, 'subject', subjectId] as const,
    material: (materialId: string) => [...analyticsQueryKeys.all, 'material', materialId] as const,
};
