import { useCallback, useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Layers, Link2, Plus } from 'lucide-react';
import type { Term } from '../../../../domain/library';
import { useTerms } from '../hooks/queries/useTerms';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { Button } from '../../../../shared/ui/Button/Button';
import SubjectTermList, { type SubjectTermListItem } from './SubjectTermList';
import AddExistingTermModal from '../modals/AddExistingTermModal';
import CreateTermModal from '../modals/CreateTermModal';
import UnlinkTermConfirmationModal from '../modals/UnlinkTermConfirmationModal';
import {
  useAddSubjectTerm,
  useRemoveSubjectTerm,
  useReorderSubjectTerms,
  useCreateAndAssignTerm,
} from '../hooks/mutations/useSubjectTermMutations';
import { useSubjectTermUsage } from '../hooks/queries/useSubjectTermUsage';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  headerText: {
    fontSize: 13.5,
    color: 'var(--color-text-secondary)',
    margin: '4px 0 0',
    maxWidth: 460,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 32px',
    textAlign: 'center',
    gap: 12,
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
    maxWidth: 380,
    lineHeight: 1.5,
  },
});

interface SubjectTermsTabProps {
  subjectId: string;
}

/**
 * Main container for the subject's Terms tab.
 *
 * Consumes `useTerms(subjectId)` plus material/usage counts, manages the
 * reorder / unlink / add-existing / create mutations and their modals,
 * and feeds the purely presentational `SubjectTermList`.
 */
export default function SubjectTermsTab({ subjectId }: SubjectTermsTabProps) {
  const { terms, isLoading } = useTerms(subjectId);
  const { materials } = useLibrary();
  const { subjectCounts } = useSubjectTermUsage(subjectId, terms);

  const addMutation = useAddSubjectTerm(subjectId);
  const removeMutation = useRemoveSubjectTerm(subjectId);
  const reorderMutation = useReorderSubjectTerms(subjectId);
  const createMutation = useCreateAndAssignTerm(subjectId);

  // Modal visibility state
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<Term | null>(null);

  // Enrich terms with material counts (materials in this subject) and
  // shared subject counts for the usage badges.
  const listItems: SubjectTermListItem[] = useMemo(() => {
    const materialCountByTerm = new Map<string, number>();
    for (const material of materials) {
      if (material.subjectId !== subjectId || !material.termId) continue;
      materialCountByTerm.set(material.termId, (materialCountByTerm.get(material.termId) ?? 0) + 1);
    }

    return terms.map((term) => ({
      term,
      materialCount: materialCountByTerm.get(term.id) ?? 0,
      subjectCount: subjectCounts.get(term.id) ?? 1,
    }));
  }, [terms, materials, subjectId, subjectCounts]);

  const handleReorder = useCallback(
    (orderedTermIds: string[]) => {
      reorderMutation.mutate(orderedTermIds);
    },
    [reorderMutation],
  );

  const handleRemove = useCallback((termId: string) => {
    const target = terms.find((t) => t.id === termId);
    if (target) setUnlinkTarget(target);
  }, [terms]);

  const handleUnlinkConfirm = useCallback(() => {
    if (!unlinkTarget) return;
    removeMutation.mutate(unlinkTarget.id);
    setUnlinkTarget(null);
  }, [unlinkTarget, removeMutation]);

  if (isLoading) {
    return (
      <div {...stylex.props(styles.container)}>
        <div {...stylex.props(styles.empty)}>
          <p {...stylex.props(styles.emptyText)}>Loading terms...</p>
        </div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.header)}>
        <div>
          <h2 {...stylex.props(styles.headerTitle)}>Assigned Terms</h2>
          <p {...stylex.props(styles.headerText)}>
            Organize study materials by term. Terms are global — reuse them
            across subjects, reorder them here, or unlink them without deleting
            the term itself.
          </p>
        </div>
        <div {...stylex.props(styles.actions)}>
          <Button
            label="Add Existing Term"
            variant="ghost"
            icon={<Link2 size={16} />}
            onClick={() => setShowAddExisting(true)}
          >
            Add Existing Term
          </Button>
          <Button
            label="Create Term"
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowCreate(true)}
          >
            Create Term
          </Button>
        </div>
      </div>

      {terms.length === 0 ? (
        <div {...stylex.props(styles.empty)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <Layers size={28} />
          </div>
          <h3 {...stylex.props(styles.emptyTitle)}>No terms assigned yet</h3>
          <p {...stylex.props(styles.emptyText)}>
            Attach an existing global term or create a new one to start grouping
            this subject&apos;s materials by term.
          </p>
          <div {...stylex.props(styles.actions)}>
            <Button
              label="Add Existing Term"
              variant="ghost"
              icon={<Link2 size={16} />}
              onClick={() => setShowAddExisting(true)}
            >
              Add Existing Term
            </Button>
            <Button
              label="Create Term"
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setShowCreate(true)}
            >
              Create Term
            </Button>
          </div>
        </div>
      ) : (
        <SubjectTermList
          terms={listItems}
          onReorder={handleReorder}
          onRemove={handleRemove}
        />
      )}

      {/* Modals */}
      {showAddExisting && (
        <AddExistingTermModal
          assignedTermIds={new Set(terms.map((t) => t.id))}
          isAdding={addMutation.isPending}
          onAdd={(termId) => addMutation.mutate(termId)}
          onClose={() => setShowAddExisting(false)}
        />
      )}

      {showCreate && (
        <CreateTermModal
          isCreating={createMutation.isPending}
          onCreate={(title) => createMutation.mutate(title)}
          onClose={() => setShowCreate(false)}
        />
      )}

      {unlinkTarget && (
        <UnlinkTermConfirmationModal
          termTitle={unlinkTarget.title}
          isPending={removeMutation.isPending}
          onConfirm={handleUnlinkConfirm}
          onCancel={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  );
}
