import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Check, Link2, Search } from 'lucide-react';
import { useTerms } from '../hooks/queries/useTerms';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button/Button';

const styles = stylex.create({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 360,
    overflowY: 'auto',
    marginTop: 4,
    paddingRight: 2,
  },
  termRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 10,
    backgroundColor: 'var(--color-background-surface)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    ':hover': {
      borderColor: 'var(--color-border-emphasized)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    },
  },
  termRowMuted: {
    opacity: 0.6,
  },
  termTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--color-text-disabled)',
    margin: '8px 2px 2px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    textAlign: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

interface AddExistingTermModalProps {
  /** IDs of terms already assigned to this subject. */
  assignedTermIds: ReadonlySet<string>;
  isAdding?: boolean;
  /** Called with the term ID to attach. */
  onAdd: (termId: string) => void;
  onClose: () => void;
}

/**
 * Modal dialog for choosing from the global term catalog.
 *
 * Sorted order: 1) unassigned terms (alphabetical), 2) assigned terms
 * (alphabetical, with a disabled "✓ Assigned" state). A search input
 * filters both groups.
 */
export default function AddExistingTermModal({
  assignedTermIds,
  isAdding = false,
  onAdd,
  onClose,
}: AddExistingTermModalProps) {
  const { terms: globalTerms, isLoading } = useTerms();
  const [query, setQuery] = useState('');

  const { unassigned, assigned } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (title: string) => !q || title.toLowerCase().includes(q);

    const unassignedList = globalTerms
      .filter((t) => !assignedTermIds.has(t.id) && matches(t.title))
      .sort((a, b) => a.title.localeCompare(b.title));

    const assignedList = globalTerms
      .filter((t) => assignedTermIds.has(t.id) && matches(t.title))
      .sort((a, b) => a.title.localeCompare(b.title));

    return { unassigned: unassignedList, assigned: assignedList };
  }, [globalTerms, assignedTermIds, query]);

  const isEmpty = !isLoading && globalTerms.length === 0;
  const noMatches = !isLoading && !isEmpty && unassigned.length === 0 && assigned.length === 0;

  return (
    <Dialog isOpen onClose={onClose} title="Add Existing Term" width={440}>
      <div {...stylex.props(styles.content)}>
        <Input
          label="Search terms"
          labelHidden
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="Search global terms..."
          startIcon={<Search size={15} />}
          clearable
          autoFocus
        />

        {isLoading ? (
          <div {...stylex.props(styles.empty)}>
            <p {...stylex.props(styles.emptyText)}>Loading terms...</p>
          </div>
        ) : isEmpty ? (
          <div {...stylex.props(styles.empty)}>
            <p {...stylex.props(styles.emptyText)}>
              No global terms available. Create one instead.
            </p>
          </div>
        ) : noMatches ? (
          <div {...stylex.props(styles.empty)}>
            <p {...stylex.props(styles.emptyText)}>
              No terms match &quot;{query.trim()}&quot;.
            </p>
          </div>
        ) : (
          <div {...stylex.props(styles.list)}>
            {unassigned.length > 0 && (
              <p {...stylex.props(styles.sectionLabel)}>Available</p>
            )}
            {unassigned.map((term) => (
              <div key={term.id} {...stylex.props(styles.termRow)}>
                <p {...stylex.props(styles.termTitle)}>{term.title}</p>
                <Button
                  label={`Add ${term.title}`}
                  variant="ghost"
                  icon={<Link2 size={14} />}
                  isDisabled={isAdding}
                  onClick={() => onAdd(term.id)}
                >
                  Add
                </Button>
              </div>
            ))}

            {assigned.length > 0 && (
              <p {...stylex.props(styles.sectionLabel)}>Already assigned</p>
            )}
            {assigned.map((term) => (
              <div key={term.id} {...stylex.props(styles.termRow, styles.termRowMuted)}>
                <p {...stylex.props(styles.termTitle)}>{term.title}</p>
                <Button
                  label={`${term.title} is already assigned`}
                  variant="ghost"
                  icon={<Check size={14} />}
                  isDisabled
                >
                  Assigned
                </Button>
              </div>
            ))}
          </div>
        )}

        <div {...stylex.props(styles.footer)}>
          <Button label="Close" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
