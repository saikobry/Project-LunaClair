import * as stylex from '@stylexjs/stylex';
import { BrainCircuit } from 'lucide-react';
import type { StudyMaterial, Term } from '../../../domain/library';
import { Button } from '../../../shared/ui/Button';
import { TermGroupedSelector } from '../../../shared/components/TermGroupedSelector/TermGroupedSelector';
import { useTermGroupedSelection } from '../../../shared/hooks/useTermGroupedSelection';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTop: '1px solid var(--color-border)',
  },
  selectionCount: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    color: 'var(--color-text-disabled)',
    fontSize: 14,
    textAlign: 'center',
    gap: 8,
  },
});

interface SubjectQuizTabProps {
  materials: StudyMaterial[];
  terms: Term[];
  onStartUnifiedQuiz: (materialIds: string[]) => void;
}

export default function SubjectQuizTab({
  materials,
  terms,
  onStartUnifiedQuiz,
}: SubjectQuizTabProps) {
  const selection = useTermGroupedSelection(materials, terms);

  if (materials.length === 0) {
    return (
      <div {...stylex.props(styles.empty)}>
        <BrainCircuit size={40} />
        <p>No materials available for quiz building.</p>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.container)}>
      <TermGroupedSelector
        materials={materials}
        terms={terms}
        selection={selection}
      />

      <div {...stylex.props(styles.actionBar)}>
        <span {...stylex.props(styles.selectionCount)}>
          {selection.selectedIds.size} of {selection.allIds.length} chapters selected
        </span>
        <Button
          label="Start Unified Quiz"
          variant="primary"
          icon={<BrainCircuit size={16} />}
          isDisabled={selection.selectedIds.size === 0}
          onClick={() => onStartUnifiedQuiz(Array.from(selection.selectedIds))}
        >
          Start Unified Quiz
        </Button>
      </div>
    </div>
  );
}
