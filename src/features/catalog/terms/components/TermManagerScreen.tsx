import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, SquarePen, Trash2, Tag } from 'lucide-react';
import { Page } from '../../../../shared/ui/Page';
import { Button } from '../../../../shared/ui/Button/Button';
import { IconButton } from '../../../../shared/ui/IconButton/IconButton';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../../shared/ui/Input';
import { ConfirmationDialog } from '../../../../shared/ui/Dialog/ConfirmationDialog';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { useTerms } from '../hooks/queries/useTerms';
import { useCreateTerm } from '../hooks/mutations/useCreateTerm';
import { useEditTerm } from '../hooks/mutations/useEditTerm';
import { useDeleteTerm } from '../hooks/mutations/useDeleteTerm';
import { useTermUsageCounts } from '../hooks/queries/useTermUsageCounts';

const styles = stylex.create({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
  termRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderRadius: 12,
    backgroundColor: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    ':hover': {
      borderColor: 'var(--color-border-emphasized)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    },
  },
  termInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  termIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  termTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  termMeta: {
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    marginTop: 2,
  },
  actions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginTop: 16,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
});

export function TermManagerScreen() {
  const { terms, isLoading } = useTerms();
  const { usageCounts } = useTermUsageCounts();
  const createMutation = useCreateTerm();
  const editMutation = useEditTerm();
  const deleteMutation = useDeleteTerm();

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<{ id: string; title: string } | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleCreate = useCallback(() => {
    if (!createTitle.trim()) return;
    createMutation.mutate({ title: createTitle.trim() });
    setCreateTitle('');
    setShowCreate(false);
  }, [createTitle, createMutation]);

  const handleEditSave = useCallback(() => {
    if (!editTarget || !editTitle.trim()) return;
    editMutation.mutate({ id: editTarget.id, input: { title: editTitle.trim() } });
    setEditTarget(null);
    setEditTitle('');
  }, [editTarget, editTitle, editMutation]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const openEdit = useCallback((term: { id: string; title: string }) => {
    setEditTarget(term);
    setEditTitle(term.title);
  }, []);

  return (
    <Page
      title="Manage Terms"
      description="Create, rename, and delete global academic terms. Terms are shared across all subjects."
      actions={
        <Button
          label="Create Term"
          variant="primary"
          icon={<Plus size={18} />}
          onClick={() => setShowCreate(true)}
        >
          Create Term
        </Button>
      }
    >
      {isLoading ? (
        <div {...stylex.props(styles.loading)}>Loading terms...</div>
      ) : terms.length === 0 ? (
        <EmptyState
          icon={<Tag size={28} />}
          title="No terms yet"
          description="Global terms like 'Prelim', 'Midterm', or 'Finals' can be created here and then assigned to subjects."
          action={
            <Button
              label="Create your first term"
              variant="primary"
              icon={<Plus size={18} />}
              onClick={() => setShowCreate(true)}
            >
              Create your first term
            </Button>
          }
        />
      ) : (
        <div {...stylex.props(styles.list)}>
          {terms.map((term) => {
            const usage = usageCounts.get(term.id);
            const subjectLabel =
              usage && usage.subjectCount > 0
                ? `${usage.subjectCount} ${usage.subjectCount === 1 ? 'subject' : 'subjects'}`
                : 'Unassigned';
            const materialLabel =
              usage && usage.materialCount > 0
                ? `${usage.materialCount} ${usage.materialCount === 1 ? 'material' : 'materials'}`
                : 'no materials';

            return (
              <div key={term.id} {...stylex.props(styles.termRow)}>
                <div {...stylex.props(styles.termInfo)}>
                  <div {...stylex.props(styles.termIcon)}>
                    <Tag size={16} />
                  </div>
                  <div>
                    <p {...stylex.props(styles.termTitle)}>{term.title}</p>
                    <p {...stylex.props(styles.termMeta)}>
                      {subjectLabel} · {materialLabel}
                    </p>
                  </div>
                </div>
                <div {...stylex.props(styles.actions)}>
                  <IconButton
                    label={`Rename ${term.title}`}
                    icon={<SquarePen size={15} />}
                    variant="ghost"
                    onClick={() => openEdit(term)}
                    tooltip="Rename"
                  />
                  <IconButton
                    label={`Delete ${term.title}`}
                    icon={<Trash2 size={15} />}
                    variant="danger"
                    onClick={() => setDeleteTarget(term)}
                    tooltip="Delete"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateTitle(''); }}
        title="Create Term"
        width={400}
      >
        <div {...stylex.props(styles.form)}>
          <Input
            label="Term name"
            value={createTitle}
            onChange={(value) => setCreateTitle(value)}
            placeholder="e.g. Prelim, Midterm, Finals"
            autoFocus
          />
          <div {...stylex.props(styles.modalActions)}>
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => { setShowCreate(false); setCreateTitle(''); }}
            />
            <Button
              label="Create"
              variant="primary"
              onClick={handleCreate}
              isDisabled={!createTitle.trim()}
              isLoading={createMutation.isPending}
            />
          </div>
        </div>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Rename Term"
        width={400}
      >
        <div {...stylex.props(styles.form)}>
          <Input
            label="Term name"
            value={editTitle}
            onChange={(value) => setEditTitle(value)}
            placeholder="e.g. Prelim, Midterm, Finals"
            autoFocus
          />
          <div {...stylex.props(styles.modalActions)}>
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => setEditTarget(null)}
            />
            <Button
              label="Save"
              variant="primary"
              onClick={handleEditSave}
              isDisabled={!editTitle.trim()}
              isLoading={editMutation.isPending}
            />
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : ''}
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.title}"? This will remove it from all subjects and clear the term assignment on any materials using it.` : ''}
        confirmLabel="Delete"
        intent="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </Page>
  );
}
