import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { AlertCircle, Plus } from 'lucide-react';
import { useTerms } from '../hooks/queries/useTerms';
import { Dialog } from '../../../../shared/ui/Dialog';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button/Button';

const styles = stylex.create({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  hint: {
    fontSize: 12.5,
    color: 'var(--color-text-disabled)',
    margin: 0,
    lineHeight: 1.5,
  },
  duplicate: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--color-error, #dc2626)',
    margin: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

interface CreateTermModalProps {
  isCreating?: boolean;
  /** Called with the trimmed title. */
  onCreate: (title: string) => void;
  onClose: () => void;
}

/**
 * Modal dialog for creating a new global term and assigning it to the
 * subject in a single atomic application-service transaction.
 *
 * Performs an optimistic client-side duplicate check against the global
 * term catalog (case-insensitive): when a duplicate title is detected the
 * submit button is disabled and an inline warning is shown. The repository
 * service remains the authoritative source of truth.
 */
export default function CreateTermModal({
  isCreating = false,
  onCreate,
  onClose,
}: CreateTermModalProps) {
  const { terms: globalTerms } = useTerms();
  const [title, setTitle] = useState('');

  const trimmed = title.trim();

  const isDuplicate = useMemo(() => {
    if (!trimmed) return false;
    const normalized = trimmed.toLowerCase();
    return globalTerms.some((t) => t.title.toLowerCase() === normalized);
  }, [globalTerms, trimmed]);

  const canSubmit = trimmed.length > 0 && !isDuplicate && !isCreating;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onCreate(trimmed);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Create Term"
      width={420}
      footer={
        <div {...stylex.props(styles.footer)}>
          <Button label="Cancel" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            label="Create & Assign"
            variant="primary"
            icon={<Plus size={16} />}
            isDisabled={!canSubmit}
            isLoading={isCreating}
            onClick={handleSubmit}
          >
            Create & Assign
          </Button>
        </div>
      }
    >
      <div {...stylex.props(styles.content)}>
        <Input
          label="Term name"
          value={title}
          onChange={(value) => setTitle(value)}
          placeholder="e.g. Prelim, Midterm, Finals"
          autoFocus
        />

        {isDuplicate && (
          <p {...stylex.props(styles.duplicate)}>
            <AlertCircle size={14} />
            A term named &quot;{trimmed}&quot; already exists globally.
          </p>
        )}

        <p {...stylex.props(styles.hint)}>
          Creates a global term and assigns it to this subject in one atomic step.
        </p>
      </div>
    </Dialog>
  );
}
