import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../domain/library/models/Subject';
import EditMaterialModal from '../../../features/materials/modals/EditMaterialModal';
import EditSubjectModal from '../../../features/subjects/modals/EditSubjectModal';
import CreateSubjectModal from '../../../features/subjects/modals/CreateSubjectModal';
import CreateMaterialModal from '../../../features/materials/modals/CreateMaterialModal';
import DeleteConfirmationModal from '../../../features/materials/modals/DeleteConfirmationModal';
import { useTerms } from '../../../features/terms/hooks/queries/useTerms';

export interface LibraryModalsProps {
  subjects: Subject[];
  editTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  subjectEditTarget: Subject | null;
  subjectDeleteTarget: Subject | null;
  showCreateSubject: boolean;
  showCreateMaterial: boolean;
  onEditSave: (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => void;
  onEditClose: () => void;
  onSubjectEditSave: (title: string, description: string) => void;
  onSubjectEditClose: () => void;
  onSubjectDeleteConfirm: () => void;
  onSubjectDeleteClose: () => void;
  onCreateSubjectSave: (title: string, description: string) => void;
  onCreateSubjectClose: () => void;
  onCreateMaterialSave: (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => void;
  onCreateMaterialClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
}

export function LibraryModals({
  subjects,
  editTarget,
  deleteTarget,
  subjectEditTarget,
  subjectDeleteTarget,
  showCreateSubject,
  showCreateMaterial,
  onEditSave,
  onEditClose,
  onSubjectEditSave,
  onSubjectEditClose,
  onSubjectDeleteConfirm,
  onSubjectDeleteClose,
  onCreateSubjectSave,
  onCreateSubjectClose,
  onCreateMaterialSave,
  onCreateMaterialClose,
  onDeleteConfirm,
  onDeleteClose,
}: LibraryModalsProps) {
  const { terms } = useTerms();

  return (
    <>
      {editTarget && (
        <EditMaterialModal
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          initialSubjectId={editTarget.subjectId}
          initialTermId={editTarget.termId}
          initialTags={editTarget.tags ?? []}
          subjects={subjects}
          terms={terms}
          onSave={onEditSave}
          onClose={onEditClose}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          title={deleteTarget.title}
          onConfirm={onDeleteConfirm}
          onClose={onDeleteClose}
        />
      )}

      {subjectEditTarget && (
        <EditSubjectModal
          initialTitle={subjectEditTarget.title}
          initialDescription={subjectEditTarget.description ?? ''}
          onSave={onSubjectEditSave}
          onClose={onSubjectEditClose}
        />
      )}

      {subjectDeleteTarget && (
        <DeleteConfirmationModal
          title={subjectDeleteTarget.title}
          onConfirm={onSubjectDeleteConfirm}
          onClose={onSubjectDeleteClose}
        />
      )}

      {showCreateSubject && (
        <CreateSubjectModal
          onSave={onCreateSubjectSave}
          onClose={onCreateSubjectClose}
        />
      )}

      {showCreateMaterial && (
        <CreateMaterialModal
          subjects={subjects}
          terms={terms}
          onSave={onCreateMaterialSave}
          onClose={onCreateMaterialClose}
        />
      )}
    </>
  );
}

export default LibraryModals;
