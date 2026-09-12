import { useState, useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as stylex from "@stylexjs/stylex";
import { X, Search, Check, Plus, BookOpen } from "lucide-react";
import { useLibrary } from "../../../features/materials/hooks/queries/useLibrary";
import { useAddMaterialToCollection } from "../../../features/collections/hooks/mutations/useAddMaterialToCollection";
import { useToast } from "../../../app/providers/ToastContext";
import { Button } from "../../../shared/ui/Button/Button";
import { IconButton } from "../../../shared/ui/IconButton/IconButton";
import { Input } from "../../../shared/ui/Input/Input";
import type { Collection } from "../../../domain/collections/models/Collection";
import type { StudyMaterial } from "../../../domain/library/models/StudyMaterial";

export interface AddMaterialsDrawerProps {
  isOpen: boolean;
  collection: Collection;
  currentMaterialIds: string[];
  onClose: () => void;
  onMaterialAdded?: (materialId: string) => void;
}

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideInRight = stylex.keyframes({
  from: { transform: "translateX(100%)" },
  to: { transform: "translateX(0)" },
});

const styles = stylex.create({
  /**
   * Right-edge slide-over rendered as a native modal `<dialog>`, opened with
   * `showModal()` so focus trapping, Escape-to-close, focus restoration, the
   * `::backdrop`, and top-layer stacking come from the platform instead of a
   * hand-rolled `role="dialog"` wrapper.
   *
   * Beyond the original box, only the UA dialog defaults that would change that
   * box are overridden — the panel must stay geometrically identical to the
   * previous portal + backdrop-overlay markup:
   * - `height: auto` overrides the UA `dialog { height: fit-content }`. With
   *   `top` and `bottom` both set, `auto` stretches the panel to the full
   *   viewport height; `fit-content` would collapse it to its content and make
   *   the over-constrained `bottom: 0` a no-op.
   * - `overflow: visible` overrides the UA `dialog:modal { overflow: auto }`,
   *   which would scroll the whole panel instead of the inner materials list.
   * - `margin: 0`, `padding: 0`, zero width borders and `max-height: none`
   *   override the UA `margin: auto`, `padding: 1em`, `border: solid` and
   *   `max-height: calc(100% - 6px - 2em)`.
   */
  drawer: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: "auto",
    height: "auto",
    margin: 0,
    width: 480,
    maxWidth: "100vw",
    maxHeight: "none",
    padding: 0,
    borderWidth: 0,
    borderStyle: "none",
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: "var(--color-border)",
    overflow: "visible",
    backgroundColor: "var(--color-background-surface)",
    color: "inherit",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
    animationName: slideInRight,
    animationDuration: "0.25s",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    "::backdrop": {
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      animationName: fadeIn,
      animationDuration: "0.2s",
      animationTimingFunction: "ease-out",
    },
  },
  header: {
    padding: 20,
    borderBottom: "1px solid var(--color-border)",
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--color-text-primary)",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "var(--color-text-secondary)",
    margin: "4px 0 0 0",
  },
  searchContainer: {
    padding: 16,
    borderBottom: "1px solid var(--color-border)",
  },
  materialsList: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
  },
  materialItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    transition: "background-color 0.16s",
  },
  materialItemHover: {
    backgroundColor: "rgba(167, 139, 250, 0.08)",
  },
  iconMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    color: "var(--color-accent, #a78bfa)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  materialContent: {
    flex: 1,
    minWidth: 0,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--color-text-primary)",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  materialTags: {
    display: "flex",
    gap: 4,
    marginTop: 4,
  },
  tag: {
    fontSize: 11,
    color: "var(--color-text-secondary)",
  },
  footer: {
    padding: 16,
    borderTop: "1px solid var(--color-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: "var(--color-text-secondary)",
  },
});

function matchesSearch(material: StudyMaterial, term: string): boolean {
  if (!term) return true;
  return (
    material.title.toLowerCase().includes(term) ||
    material.tags?.some((t) => t.toLowerCase().includes(term)) === true
  );
}

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Native modal: opened imperatively. A layout effect promotes the panel to
  // the top layer before the first paint, so there is no un-modal frame.
  useLayoutEffect(() => {
    if (isOpen && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [isOpen]);

  // Lock body scroll while the drawer is open so the main page scrollbar
  // hides and the background cannot scroll behind the modal.
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Stable close indirection for the dismissal effects below. `onClose` is an
  // inline parent callback with a fresh identity every render — reading it
  // through an Effect Event (same pattern as `computePosition` in
  // `CompactCollectionsPopover`) keeps the listeners from re-subscribing on
  // unrelated parent redraws.
  const onCloseEvent = useEffectEvent(() => {
    onClose();
  });

  // Escape fallback: the native `cancel` event only fires while the dialog is
  // truly modal. If `showModal()` ever didn't take (or a child consumes the
  // keydown), this document listener still guarantees Escape closes the
  // drawer — the same guarantee the pre-dialog version had.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCloseEvent();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Backdrop dismissal: a native modal renders its backdrop as a ::backdrop
  // pseudo-element, so the click arrives on the <dialog> element itself. Bound
  // imperatively rather than as a JSX handler on non-interactive markup.
  // Re-runs on `isOpen` (not `onClose`) so the listener attaches once the
  // dialog actually mounts.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) onCloseEvent();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [isOpen]);

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

  // Escape inside a modal fires `cancel`; route it through onClose so the
  // drawer's open state stays the single source of truth.
  //
  // Portalled to `document.body` so the panel inherits from the same place the
  // previous markup did, and so no ancestor transform/filter can become the
  // containing block for this fixed-position dialog.
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="Add materials to collection"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...stylex.props(styles.drawer)}
    >
      <div {...stylex.props(styles.header)}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
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
          <p
            style={{
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            No materials found.
          </p>
        ) : (
          visibleMaterials.map((material) => {
            const isInCollection = currentMaterialIdSet.has(material.id);
            return (
              <div
                key={material.id}
                {...stylex.props(
                  styles.materialItem,
                  !isInCollection && styles.materialItemHover
                )}
              >
                <div {...stylex.props(styles.iconMark)}>
                  <BookOpen size={18} />
                </div>
                <div {...stylex.props(styles.materialContent)}>
                  <h4 {...stylex.props(styles.materialTitle)}>
                    {material.title}
                  </h4>
                  {material.tags && material.tags.length > 0 && (
                    <div {...stylex.props(styles.materialTags)}>
                      {material.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          {...stylex.props(styles.tag)}
                        >
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
                      color: "var(--color-success, #10b981)",
                      borderColor: "rgba(16, 185, 129, 0.3)",
                      backgroundColor: "rgba(16, 185, 129, 0.08)",
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
                    onClick={() => handleAdd(material.id)}
                    style={{
                      color: "var(--color-accent, #a78bfa)",
                      borderColor: "rgba(167, 139, 250, 0.35)",
                      backgroundColor: "rgba(167, 139, 250, 0.08)",
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
          })
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
