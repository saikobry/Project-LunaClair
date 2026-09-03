/**
 * Subject query keys — owns the subjects cache namespace (`['subject', ...]`).
 */
export const subjectQueryKeys = {
  all: ['subject', 'subjects'] as const,
  subjects: () => ['subject', 'subjects'] as const,
  subject: (id: string) => ['subject', 'subject', id] as const,
};
