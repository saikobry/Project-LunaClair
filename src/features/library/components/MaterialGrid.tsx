import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../../domain/library';
import { MaterialCard } from '../../../shared/ui/MaterialCard/MaterialCard';
import { styles } from '../styles/library.stylex';

interface MaterialGridProps {
  materials: StudyMaterial[];
  onOpen: (material: StudyMaterial) => void;
  onRename: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
}

export default function MaterialGrid({ materials, onOpen, onRename, onDelete, onStartQuiz, onManage }: MaterialGridProps) {
  return (
    <div {...stylex.props(styles.grid)}>
      {materials.map((material) => (
        <MaterialCard
          key={material.id}
          material={material}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          onStartQuiz={onStartQuiz}
          onManage={onManage}
        />
      ))}
    </div>
  );
}
