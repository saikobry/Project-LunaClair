import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-text-secondary)',
  },
  chip: {
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
  },
  empty: {
    fontSize: 11,
    fontStyle: 'italic',
    color: 'var(--color-text-secondary)',
  },
});

export interface DraftTagListProps {
  /** Topic tags the model proposed for this draft. */
  tags?: string[];
}

/**
 * The classification tags a draft will be saved with, shown at review time.
 *
 * Tags are set on the draft before it is persisted, so they have to be visible *before* Add — the
 * review step is the only chance to see what a saved item will be filed under. Reading them here
 * also makes a silent failure legible: a model that returns no usable tags shows "No tags suggested"
 * rather than an empty gap that looks like a rendering bug.
 *
 * Read-only by design — the tags are the model's classification, and the Question Bank's own tag
 * editor is where a user refines them. Shared by both preview cards so the two review steps cannot
 * drift, and so the row is one implementation rather than a duplicated subtree.
 */
export function DraftTagList({ tags }: DraftTagListProps) {
  const hasTags = Boolean(tags && tags.length > 0);

  return (
    <div {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.label)}>Tags</span>
      {hasTags ? (
        tags?.map((tag) => (
          <span key={tag} {...stylex.props(styles.chip)}>
            {tag}
          </span>
        ))
      ) : (
        <span {...stylex.props(styles.empty)}>No tags suggested</span>
      )}
    </div>
  );
}
