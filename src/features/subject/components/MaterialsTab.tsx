import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Plus } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library';
import type { Term } from '../../../domain/library';
import { MaterialCard } from '../../../shared/components/MaterialCard/MaterialCard';
import { Button } from '../../../shared/ui/Button';
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 32px',
    textAlign: 'center',
    gap: 12,
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  emptyText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
    maxWidth: 360,
    lineHeight: 1.5,
  },
});

interface MaterialsTabProps {
  materials: StudyMaterial[];
  terms: Term[];
  onOpen: (materialId: string) => void;
  onStartQuiz: (request: { materialId: string; source: string; subjectId?: string }) => void;
  onManage: (materialId: string, subjectId?: string) => void;
  onEdit?: (material: StudyMaterial) => void;
  onDelete?: (material: StudyMaterial) => void;
  onAddMaterial?: () => void;
  isAddingMaterial?: boolean;
}

export default function MaterialsTab({
  materials,
  terms,
  onOpen,
  onStartQuiz,
  onManage,
  onEdit,
  onDelete,
  onAddMaterial,
  isAddingMaterial = false,
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

      {materials.length === 0 ? (
        /* Full empty state — no materials exist yet */
        <div {...stylex.props(styles.empty)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookOpen size={28} />
          </div>
          <h3 {...stylex.props(styles.emptyTitle)}>No materials yet</h3>
          <p {...stylex.props(styles.emptyText)}>
            This subject doesn't have any study materials yet.
            Create your first material to start studying.
          </p>
          {onAddMaterial && (
            <Button
              label="Create your first material"
              variant="primary"
              icon={<Plus size={18} />}
              onClick={onAddMaterial}
              isLoading={isAddingMaterial}
            >
              Create your first material
            </Button>
          )}
        </div>
      ) : filteredMaterials.length === 0 ? (
        /* Filtered empty state — materials exist but none match the filter */
        <div {...stylex.props(styles.empty)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookOpen size={28} />
          </div>
          <h3 {...stylex.props(styles.emptyTitle)}>No matching materials</h3>
          <p {...stylex.props(styles.emptyText)}>
            No materials match the current term filter. Try selecting a different term.
          </p>
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
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
