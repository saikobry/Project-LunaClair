import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../../domain/library';
import { styles } from '../styles/library.stylex';
import MaterialCard from './MaterialCard';

interface MaterialGridProps {
  materials: StudyMaterial[];
  onOpen: (material: StudyMaterial) => void;
  onRename: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
}

export default function MaterialGrid({ materials, onOpen, onRename, onDelete, onStartQuiz }: MaterialGridProps) {
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
        />
      ))}
    </div>
  );
}
