export const subjectQueryKeys = {
  root: ['subject'] as const,
  subjects: () => [...subjectQueryKeys.root, 'subjects'] as const,
  subject: (id: string) => [...subjectQueryKeys.root, 'subject', id] as const,
  terms: () => [...subjectQueryKeys.root, 'terms'] as const,
  termsBySubject: (subjectId: string) =>
    [...subjectQueryKeys.root, 'terms', subjectId] as const,
  term: (id: string) => [...subjectQueryKeys.root, 'term', id] as const,
  termUsageCounts: () => [...subjectQueryKeys.root, 'terms', 'usageCounts'] as const,
  subjectTermUsage: (subjectId: string) =>
    [...subjectQueryKeys.root, 'terms', subjectId, 'subjectUsage'] as const,
};
