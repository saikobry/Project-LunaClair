/**
 * Term query keys — owns the terms and subject-term links cache namespace.
 */
export const termQueryKeys = {
  all: ['subject', 'terms'] as const,
  terms: () => ['subject', 'terms'] as const,
  termsBySubject: (subjectId: string) =>
    ['subject', 'terms', subjectId] as const,
  term: (id: string) => ['subject', 'term', id] as const,
  termUsageCounts: () => ['subject', 'terms', 'usageCounts'] as const,
  subjectTermUsage: (subjectId: string) =>
    ['subject', 'terms', subjectId, 'subjectUsage'] as const,
};
