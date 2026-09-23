/**
 * Canonical package display formatters.
 *
 * Moved verbatim from `StudyPackagePreviewModal` and `SharedPackageScreen`,
 * which each carried identical copies. Single ownership from here on.
 */
export function formatQuestionType(type: string): string {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'multiple_select':
      return 'Multiple Select';
    case 'true_false':
      return 'True/False';
    case 'identification':
      return 'Identification';
    case 'fill_in_blank':
      return 'Fill in Blank';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function formatPackageDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
