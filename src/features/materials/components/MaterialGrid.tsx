import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { MaterialCard } from './MaterialCard';
import { styles } from '../styles/library.stylex';

interface MaterialGridProps {
  materials: StudyMaterial[];
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onNavigate?: (collectionId: string) => void;
}

export default function MaterialGrid({ materials, onOpen, onEdit, onDelete, onStartQuiz, onManage, onNavigate }: MaterialGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Animate on mount when data loads. Use materials.length (a stable
  // primitive) as dependency so stale re-renders from filtered-array
  // references don't trigger re-animation.
  useGSAP(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.children;
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { dependencies: [materials.length] });

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
        />
      ))}
    </div>
  );
}
