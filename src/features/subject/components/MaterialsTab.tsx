import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../../domain/library';
import type { Term } from '../../../domain/library';
import { MaterialCard } from '../../../shared/components/MaterialCard/MaterialCard';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  empty: {
    textAlign: 'center',
    padding: 32,
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
});

interface MaterialsTabProps {
  materials: StudyMaterial[];
  terms: Term[];
  onOpen: (materialId: string) => void;
  onStartQuiz: (request: { materialId: string; source: string; subjectId?: string }) => void;
  onManage: (materialId: string, subjectId?: string) => void;
  onRename?: (material: StudyMaterial) => void;
  onDelete?: (material: StudyMaterial) => void;
}

export default function MaterialsTab({
  materials,
  terms,
  onOpen,
  onStartQuiz,
  onManage,
  onRename,
  onDelete,
}: MaterialsTabProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const termMap = useMemo(
    () => new Map(terms.map((t) => [t.id, t.title])),
    [terms],
  );

  const availableTerms = useMemo(() => {
    const presentTermIds = new Set(
      materials.flatMap((m) => (m.termId ? [m.termId] : [])),
    );
    return terms
      .filter((t) => presentTermIds.has(t.id))
      .toSorted((a, b) => a.order - b.order);
  }, [terms, materials]);

  const filteredMaterials = useMemo(() => {
    if (!activeFilter) return materials;
    return materials.filter((m) => m.termId === activeFilter);
  }, [materials, activeFilter]);

  return (
    <div {...stylex.props(styles.container)}>
      {availableTerms.length > 1 && (
        <SegmentedControl
          value={activeFilter ?? 'all'}
          onChange={(v: string) => setActiveFilter(v === 'all' ? null : v)}
          label="Term filter"
          size="sm"
          layout="fill"
        >
          <SegmentedControlItem value="all" label="All" />
          {availableTerms.map((term) => (
            <SegmentedControlItem key={term.id} value={term.id} label={term.title} />
          ))}
        </SegmentedControl>
      )}

      {filteredMaterials.length === 0 ? (
        <div {...stylex.props(styles.empty)}>
          No materials found for this filter.
        </div>
      ) : (
        <div {...stylex.props(styles.grid)}>
          {filteredMaterials.map((material) => {
            const termTitle = material.termId ? termMap.get(material.termId) : undefined;
            return (
              <MaterialCard
                key={material.id}
                material={material}
                termTitle={termTitle}
                onOpen={(m) => onOpen(m.id)}
                onStartQuiz={(m) => onStartQuiz({ materialId: m.id, source: 'subject', subjectId: m.subjectId })}
                onManage={(m) => onManage(m.id, m.subjectId)}
                onRename={onRename}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
