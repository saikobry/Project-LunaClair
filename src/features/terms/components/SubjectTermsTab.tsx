import { useCallback, useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Layers, Link2, Plus } from 'lucide-react';
import type { Term } from '../../../domain/library/models/Term';
import { useTerms } from '../hooks/queries/useTerms';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
});

interface SubjectTermsTabProps {
  subjectId: string;
  /** Whether the "Add Existing Term" modal is open — controlled by the workspace Page header actions. */
  showAddExisting: boolean;
  /** Whether the "Create Term" modal is open — controlled by the workspace Page header actions. */
  showCreate: boolean;
  onOpenAddExisting: () => void;
  onOpenCreate: () => void;
  onCloseAddExisting: () => void;
  onCloseCreate: () => void;
}

/**
 * Main container for the subject's Terms tab.
 *
 * Consumes `useTerms(subjectId)` plus material/usage counts, owns the
 * reorder / unlink / add-existing / create mutations, and renders the
 * term modals. Modal open-state is controlled by the parent
 * `SubjectWorkspace` (which hosts the tab actions in the Page header),
 * while `unlinkTarget` stays local. Feeds the purely presentational
 * `SubjectTermList`.
 */
export default function SubjectTermsTab({
  subjectId,
  showAddExisting,
  showCreate,
  onOpenAddExisting,
  onOpenCreate,
  onCloseAddExisting,
  onCloseCreate,
}: SubjectTermsTabProps) {
  const { terms, isLoading } = useTerms(subjectId);
  const { materials } = useLibrary();
  const { subjectCounts } = useSubjectTermUsage(subjectId, terms);

  const addMutation = useAddSubjectTerm(subjectId);
  const removeMutation = useRemoveSubjectTerm(subjectId);
  const reorderMutation = useReorderSubjectTerms(subjectId);
  const createMutation = useCreateAndAssignTerm(subjectId);

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
        <div {...stylex.props(styles.loading)}>Loading terms...</div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.container)}>
      {terms.length === 0 ? (
        <EmptyState
          icon={<Layers size={28} />}
          title="No terms assigned yet"
          description="Attach an existing global term or create a new one to start grouping this subject's materials by term."
          headingLevel="h3"
          action={
            <Button
              label="Add Existing Term"
              variant="secondary"
              icon={<Link2 size={16} />}
              onClick={onOpenAddExisting}
            >
              Add Existing Term
            </Button>
          }
          secondaryAction={
            <Button
              label="Create Term"
              variant="primary"
              icon={<Plus size={16} />}
              onClick={onOpenCreate}
            >
              Create Term
            </Button>
          }
        />
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
          onClose={onCloseAddExisting}
        />
      )}

      {showCreate && (
        <CreateTermModal
          isCreating={createMutation.isPending}
          onCreate={(title) => createMutation.mutate(title)}
          onClose={onCloseCreate}
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
