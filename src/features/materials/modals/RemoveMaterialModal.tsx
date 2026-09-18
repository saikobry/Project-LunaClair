import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

interface RemoveMaterialModalProps {
  /** The material being removed — its `originShareId` decides the recovery sentence. */
  material: StudyMaterial;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirms removing one material from the local library.
 *
 * The copy names what the cascade actually deletes — the material's document, its questions and
 * quizzes, the files stored with it, and its place in the user's collections — because removal
 * reaches well past the card that was clicked.
 *
 * Recovery is the one thing that differs per material, so the closing sentence branches on
 * provenance: a cloned material's published share is untouched (it can be cloned again, but local
 * edits are not part of it), while a material created on this device exists nowhere else.
 */
export default function RemoveMaterialModal({
  material,
  onConfirm,
  onClose,
}: RemoveMaterialModalProps) {
  const recovery = material.originShareId
    ? 'You can clone the share again from Explore, but anything you added or edited here is gone.'
    : 'This material is not published anywhere, so it cannot be restored.';

  return (
    <ConfirmationDialog
      isOpen
      title="Remove from Library?"
      message={`Removing "${material.title}" deletes its document, its questions and quizzes, the files stored with it, and its place in your collections. ${recovery}`}
      confirmLabel="Remove from Library"
      cancelLabel="Cancel"
      intent="danger"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
