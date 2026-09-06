import { useState, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Download, Plus } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Term } from '../../../domain/library/models/Term';
import { MaterialCard } from '../../materials/components/MaterialCard';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
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
  onBrowseAvailable?: () => void;
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
  onBrowseAvailable,
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
    return terms.filter((t) => presentTermIds.has(t.id));
  }, [terms, materials]);

  const filteredMaterials = useMemo(() => {
    if (!activeFilter) return materials;
    return materials.filter((m) => m.termId === activeFilter);
  }, [materials, activeFilter]);

  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.children;
    if (cards.length === 0) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { dependencies: [filteredMaterials] });

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
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No materials yet"
          description="This subject doesn't have any study materials in your library yet. Explore shared study packages or create a custom material."
          headingLevel="h3"
          action={
            onBrowseAvailable && (
              <Button
                label="Explore Study Packages"
                variant="primary"
                icon={<Download size={16} />}
                onClick={onBrowseAvailable}
              >
                Explore Study Packages
              </Button>
            )
          }
          secondaryAction={
            onAddMaterial && (
              <Button
                label="Create Custom Material"
                variant={onBrowseAvailable ? 'secondary' : 'primary'}
                icon={<Plus size={16} />}
                onClick={onAddMaterial}
                isLoading={isAddingMaterial}
              >
                Create Custom Material
              </Button>
            )
          }
        />
      ) : filteredMaterials.length === 0 ? (
        /* Filtered empty state — materials exist but none match the filter */
        <EmptyState
          icon={<BookOpen size={28} />}
          iconVariant="muted"
          title="No matching materials"
          description="No materials match the current term filter. Try selecting a different term."
          headingLevel="h3"
        />
      ) : (
        <div ref={gridRef} {...stylex.props(styles.grid)}>
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
