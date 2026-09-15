import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as stylex from "@stylexjs/stylex";
import { X, Search, Check, Plus, BookOpen } from "lucide-react";
import { useLibrary } from "../../../../features/materials/hooks/queries/useLibrary";
import { useAddMaterialToCollection } from "../../../../features/collections/hooks/mutations/useAddMaterialToCollection";
import { useToast } from "../../../../app/providers/ToastContext";
import { useModalDialog } from "../../../../shared/hooks/useModalDialog";
import { Button } from "../../../../shared/ui/Button/Button";
import { IconButton } from "../../../../shared/ui/IconButton/IconButton";
import { Input } from "../../../../shared/ui/Input/Input";
import type { Collection } from "../../../../domain/collections/models/Collection";
import type { StudyMaterial } from "../../../../domain/library/models/StudyMaterial";
import { styles } from "../styles/addMaterialsDrawer.stylex";
import { matchesSearch } from "../utils/materialSearch";

export interface AddMaterialsDrawerProps {
  isOpen: boolean;
  collection: Collection;
  currentMaterialIds: string[];
  onClose: () => void;
  onMaterialAdded?: (materialId: string) => void;
}

/** One library material row with its Add / Added affordance. */
function MaterialPickerRow({
  material,
  isInCollection,
  onAdd,
}: {
  material: StudyMaterial;
  isInCollection: boolean;
  onAdd: (materialId: string) => void;
}) {
  return (
    <div
      {...stylex.props(styles.materialItem, !isInCollection && styles.materialItemHover)}
    >
      <div {...stylex.props(styles.iconMark)}>
        <BookOpen size={18} />
      </div>
      <div {...stylex.props(styles.materialContent)}>
        <h4 {...stylex.props(styles.materialTitle)}>{material.title}</h4>
        {material.tags && material.tags.length > 0 && (
          <div {...stylex.props(styles.materialTags)}>
            {material.tags.slice(0, 2).map((tag) => (
              <span key={tag} {...stylex.props(styles.tag)}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {isInCollection ? (
        <Button
          label={`Added ${material.title}`}
          variant="secondary"
          icon={<Check size={13} />}
          isDisabled
          style={{
            color: "var(--color-success)",
            borderColor: "var(--color-success-border)",
            backgroundColor: "var(--color-success-muted)",
            minHeight: 32,
            padding: "4px 10px",
            fontSize: 12,
            opacity: 1,
          }}
        >
          Added
        </Button>
      ) : (
        <Button
          label={`Add ${material.title}`}
          variant="secondary"
          icon={<Plus size={13} />}
          onClick={() => onAdd(material.id)}
          style={{
            color: "var(--color-accent)",
            borderColor: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
            backgroundColor: "var(--color-overlay-hover)",
            minHeight: 32,
            padding: "4px 10px",
            fontSize: 12,
          }}
        >
          Add
        </Button>
      )}
    </div>
  );
}

/**
 * Right-edge slide-over for adding library materials to a collection.
 *
 * Presented as a native modal `<dialog>` (see `useModalDialog`), portalled to
 * `document.body` so no ancestor transform/filter can become the containing
 * block for the fixed-position panel. Mounted only while open; the dialog
 * plumbing (open promotion, body scroll lock, backdrop dismissal, and an Escape
 * keydown fallback) lives in the shared hook, while Escape *semantics* stay here
 * on `onCancel` so the drawer's open state remains the single source of truth.
 */
export function AddMaterialsDrawer({
  isOpen,
  collection,
  currentMaterialIds,
  onClose,
  onMaterialAdded,
}: AddMaterialsDrawerProps) {
  const { materials } = useLibrary();
  const addMutation = useAddMaterialToCollection();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");

  const dialogRef = useModalDialog({
    isOpen,
    onBackdropClick: onClose,
    lockScroll: true,
    onEscape: onClose,
  });

  // Membership and search are resolved once per render instead of re-scanning
  // the library for every row.
  const currentMaterialIdSet = new Set(currentMaterialIds);
  const visibleMaterials = (materials ?? []).filter((m) =>
    matchesSearch(m, searchTerm.toLowerCase()),
  );

  const handleAdd = useCallback(
    (materialId: string) => {
      if (currentMaterialIds.includes(materialId)) return;
      addMutation.mutate(
        { collectionId: collection.id, materialId },
        {
          onSuccess: () => {
            showToast(`Added to ${collection.title}`, { intent: "success" });
            onMaterialAdded?.(materialId);
          },
          onError: () => {
            showToast("Failed to add material", { intent: "error" });
          },
        }
      );
    },
    [collection, currentMaterialIds, addMutation, showToast, onMaterialAdded]
  );

  if (!isOpen) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="Add materials to collection"
      onCancel={(event) => {
        // Escape inside a modal fires `cancel`; route it through onClose so the
        // drawer's open state stays the single source of truth.
        event.preventDefault();
        onClose();
      }}
      {...stylex.props(styles.drawer)}
    >
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerRow)}>
          <div>
            <h2 {...stylex.props(styles.title)}>Add from your Library</h2>
            <p {...stylex.props(styles.subtitle)}>
              Build "{collection.title}" one good idea at a time.
            </p>
          </div>
          <IconButton
            label="Close drawer"
            icon={<X size={18} />}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </div>

      <div {...stylex.props(styles.searchContainer)}>
        <Input
          label="Search materials"
          labelHidden
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          placeholder="Search titles or tags..."
          startIcon={
            <Search size={15} style={{ color: "var(--color-text-secondary)" }} />
          }
          clearable
        />
      </div>

      <div {...stylex.props(styles.materialsList)}>
        {visibleMaterials.length === 0 ? (
          <p {...stylex.props(styles.listEmpty)}>No materials found.</p>
        ) : (
          visibleMaterials.map((material) => (
            <MaterialPickerRow
              key={material.id}
              material={material}
              isInCollection={currentMaterialIdSet.has(material.id)}
              onAdd={handleAdd}
            />
          ))
        )}
      </div>

      <div {...stylex.props(styles.footer)}>
        <span {...stylex.props(styles.footerText)}>
          {currentMaterialIds.length} materials in this collection
        </span>
        <Button
          label="Done"
          variant="primary"
          icon={<Check size={15} />}
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </dialog>,
    document.body,
  );
}

export default AddMaterialsDrawer;
