import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../../domain/library/models/Subject';
import EditMaterialModal from '../modals/EditMaterialModal';
import EditSubjectModal from '../../subjects/modals/EditSubjectModal';
import CreateSubjectModal from '../../subjects/modals/CreateSubjectModal';
import CreateMaterialModal from '../modals/CreateMaterialModal';
import DeleteConfirmationModal from '../modals/DeleteConfirmationModal';

interface LibraryModalsProps {
    subjects: Subject[];
    editTarget: StudyMaterial | null;
    deleteTarget: StudyMaterial | null;
    subjectEditTarget: Subject | null;
    subjectDeleteTarget: Subject | null;
    showCreateSubject: boolean;
    showCreateMaterial: boolean;
    onEditSave: (title: string, description: string, subjectId?: string | null, termId?: string | null) => void;
    onEditClose: () => void;
    onSubjectEditSave: (title: string, description: string) => void;
    onSubjectEditClose: () => void;
    onSubjectDeleteConfirm: () => void;
    onSubjectDeleteClose: () => void;
    onCreateSubjectSave: (title: string, description: string) => void;
    onCreateSubjectClose: () => void;
    onCreateMaterialSave: (title: string, description: string, subjectId?: string | null, termId?: string | null) => void;
    onCreateMaterialClose: () => void;
    onDeleteConfirm: () => void;
    onDeleteClose: () => void;
}

export default function LibraryModals({
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
    return (
        <>
            {editTarget && (
                <EditMaterialModal
                    initialTitle={editTarget.title}
                    initialDescription={editTarget.description ?? ''}
                    initialSubjectId={editTarget.subjectId}
                    initialTermId={editTarget.termId}
                    subjects={subjects}
                    onSave={onEditSave}
                    onClose={onEditClose}
                />
            )}

            {showCreateSubject && (
                <CreateSubjectModal
                    onSave={onCreateSubjectSave}
                    onClose={onCreateSubjectClose}
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
                    itemType="Subject"
                    onConfirm={onSubjectDeleteConfirm}
                    onClose={onSubjectDeleteClose}
                />
            )}

            {showCreateMaterial && (
                <CreateMaterialModal
                    subjects={subjects}
                    onSave={onCreateMaterialSave}
                    onClose={onCreateMaterialClose}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmationModal
                    title={deleteTarget.title}
                    onConfirm={onDeleteConfirm}
                    onClose={onDeleteClose}
                />
            )}
        </>
    );
}
