import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { styles } from '../styles/collectionMaterialList.stylex';
import { CollectionMaterialRow } from './CollectionMaterialRow';
import { useCollectionMaterialReorder } from '../hooks/useCollectionMaterialReorder';

export interface CollectionMaterialListProps {
  collectionId: string;
  materials: StudyMaterial[];
  onOpenMaterial?: (materialId: string) => void;
  onRemoveMaterial: (materialId: string) => void;
  onReorder?: (orderedMaterialIds: string[]) => void;
  onAddMaterials: () => void;
}

/**
 * Playlist list view for a collection.
 *
 * Thin composer: rows come from `CollectionMaterialRow` and all drag/reorder
 * behaviour (GSAP Draggable, mobile hold-to-drag, keyboard arrows) lives in
 * `useCollectionMaterialReorder`. The local `items` mirror exists because
 * reordering is optimistic — the new order renders before the mutation settles.
 */
export function CollectionMaterialList({
  materials,
  onOpenMaterial,
  onRemoveMaterial,
  onReorder,
  onAddMaterials,
}: CollectionMaterialListProps) {
  const [prevMaterials, setPrevMaterials] = useState(materials);
  const [items, setItems] = useState<StudyMaterial[]>(materials);

  // Sync internal items when parent materials prop changes (during render phase)
  if (materials !== prevMaterials) {
    setPrevMaterials(materials);
    setItems(materials);
  }

  const { listRef, holdRingRef, holdCircleRef, moveItem } = useCollectionMaterialReorder({
    items,
    setItems,
    onReorder,
  });

  if (items.length === 0) {
    return (
      <EmptyState
        title="Every great collection starts with one idea."
        description="Bring in materials from your Library. They can belong here and in any other collection, too."
        icon={<BookOpen size={28} />}
        action={
          <Button label="Add Materials" variant="primary" icon={<Plus size={16} />} onClick={onAddMaterials}>
            Add Materials
          </Button>
        }
      />
    );
  }

  return (
    <div ref={listRef} {...stylex.props(styles.list)}>
      {/* Hold-to-drag circular progressing border ring */}
      <svg
        ref={holdRingRef}
        width="56"
        height="56"
        viewBox="0 0 56 56"
        aria-hidden="true"
        {...stylex.props(styles.holdRing)}
      >
        <circle
          cx="28"
          cy="28"
          r="22"
          fill="color-mix(in srgb, var(--color-accent) 16%, transparent)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="2.5"
        />
        <circle
          ref={holdCircleRef}
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeDasharray={138.23}
          strokeDashoffset={138.23}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
        />
      </svg>

      {items.map((material, index) => (
        <CollectionMaterialRow
          key={material.id}
          material={material}
          index={index}
          totalCount={items.length}
          onOpenMaterial={onOpenMaterial}
          onRemoveMaterial={onRemoveMaterial}
          onMove={moveItem}
        />
      ))}

      <div {...stylex.props(styles.footer)}>
        <button type="button" {...stylex.props(styles.addButton)} onClick={onAddMaterials}>
          <Plus size={16} /> Add materials from your Library
        </button>
        <span {...stylex.props(styles.footerText)}>
          Reordering only changes this collection. Your other learning paths stay just as they are.
        </span>
      </div>
    </div>
  );
}

export default CollectionMaterialList;
