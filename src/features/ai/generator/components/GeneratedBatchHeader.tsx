/**
 * The review step's header for a generated batch: how many drafts are on screen, how many are
 * selected, and how many the model returned that had to be dropped.
 *
 * Shared by both generator dialogs, which is the point — the two review steps are the same surface
 * with a different noun, and keeping one implementation means the salvage message cannot drift
 * between them.
 *
 * Salvaging the valid drafts is deliberate, but it must not be silent: a request for 10 questions
 * that opens with 8 needs the gap named, or the count reads as a model shortfall rather than a
 * rejected item.
 */
export interface GeneratedBatchHeaderProps {
  generatedCount: number;
  selectedCount: number;
  rejectedCount: number;
  /** Noun for one draft, e.g. `question`. */
  singular: string;
  /** Noun for several drafts, e.g. `questions`. */
  plural: string;
}

export function GeneratedBatchHeader({
  generatedCount,
  selectedCount,
  rejectedCount,
  singular,
  plural,
}: GeneratedBatchHeaderProps) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        Generated {generatedCount} {plural} ({selectedCount} selected)
      </div>
      {rejectedCount > 0 && (
        <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>
          {rejectedCount} {rejectedCount === 1 ? singular : plural} could not be read and{' '}
          {rejectedCount === 1 ? 'was' : 'were'} skipped.
        </span>
      )}
    </div>
  );
}
