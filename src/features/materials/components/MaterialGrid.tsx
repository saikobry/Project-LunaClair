import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { VIRTUALIZE_AFTER_ITEM_COUNT } from '../../../shared/constants/listRendering';
import { MaterialCard } from './MaterialCard';
import { VirtualMaterialGrid } from './VirtualMaterialGrid';
import { styles } from '../styles/library.stylex';

interface MaterialGridProps {
  materials: StudyMaterial[];
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onNavigate?: (collectionId: string) => void;
  onToggleTag?: (tag: string) => void;
  selectedTags?: string[];
}

export default function MaterialGrid({ materials, onOpen, onEdit, onDelete, onStartQuiz, onManage, onNavigate, onToggleTag, selectedTags }: MaterialGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Past the threshold the grid virtualizes — recycled rows and the
  // enter-animation fight each other, so the animation stays on the plain path.
  const virtualized = materials.length > VIRTUALIZE_AFTER_ITEM_COUNT;

  // Animate on mount when data loads. Use materials.length (a stable
  // primitive) as dependency so stale re-renders from filtered-array
  // references don't trigger re-animation.
  useGSAP(() => {
    if (virtualized || !gridRef.current) return;
    const cards = gridRef.current.children;
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { dependencies: [materials.length, virtualized] });

  if (virtualized) {
    return (
      <VirtualMaterialGrid
        materials={materials}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        onStartQuiz={onStartQuiz}
        onManage={onManage}
        onNavigate={onNavigate}
        onToggleTag={onToggleTag}
        selectedTags={selectedTags}
      />
    );
  }

  return (
    <div ref={gridRef} {...stylex.props(styles.grid)}>
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          onStartQuiz={onStartQuiz}
          onManage={onManage}
          onNavigate={onNavigate}
          onToggleTag={onToggleTag}
          selectedTags={selectedTags}
        />
      ))}
    </div>
  );
}
