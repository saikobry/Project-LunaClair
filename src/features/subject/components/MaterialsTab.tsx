import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Eye, BrainCircuit, ClipboardList } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library';
import type { Term } from '../../../domain/library';
import { Card, Button, SegmentedControl, SegmentedControlItem, Chip } from '../../../shared/ui';

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
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  cardMeta: {
    fontSize: 12,
    color: 'var(--color-text-disabled)',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
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

interface MaterialsTabProps {
  materials: StudyMaterial[];
  terms: Term[];
  onOpen: (materialId: string) => void;
  onStartQuiz: (request: { materialId: string; source: string }) => void;
  onManage: (materialId: string) => void;
}

export default function MaterialsTab({
  materials,
  terms,
  onOpen,
  onStartQuiz,
  onManage,
}: MaterialsTabProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const availableTerms = useMemo(() => {
    const usedTermIds = new Set(materials.map((m) => m.termId));
    return terms
      .filter((term) => usedTermIds.has(term.id))
      .toSorted((a, b) => a.order - b.order);
  }, [terms, materials]);

  const filteredMaterials = useMemo(() => {
    if (!activeFilter) return materials;
    return materials.filter((m) => m.termId === activeFilter);
  }, [materials, activeFilter]);

  return (
    <div {...stylex.props(styles.container)}>
      <SegmentedControl
        value={activeFilter ?? 'all'}
        onChange={(v) => setActiveFilter(v === 'all' ? null : v)}
        label="Term filter"
        size="sm"
      >
        <SegmentedControlItem value="all" label="All" />
        {availableTerms.map((term) => (
          <SegmentedControlItem key={term.id} value={term.id} label={term.title} />
        ))}
      </SegmentedControl>

      {filteredMaterials.length === 0 ? (
        <div {...stylex.props(styles.empty)}>
          No materials found for this filter.
        </div>
      ) : (
        <div {...stylex.props(styles.grid)}>
          {filteredMaterials.map((material) => (
            <Card key={material.id}>
              <div {...stylex.props(styles.cardContent)}>
                <h3 {...stylex.props(styles.cardTitle)}>{material.title}</h3>
                {material.description && (
                  <p {...stylex.props(styles.cardDescription)}>{material.description}</p>
                )}
                <div>
                  <Chip>{material.sourceType}</Chip>
                </div>
                <div {...stylex.props(styles.cardActions)}>
                  <Button
                    label={`Open ${material.title}`}
                    variant="secondary"
                    icon={<Eye size={14} />}
                    isIconOnly
                    onClick={() => onOpen(material.id)}
                  />
                  <Button
                    label={`Quiz for ${material.title}`}
                    variant="secondary"
                    icon={<BrainCircuit size={14} />}
                    isIconOnly
                    onClick={() => onStartQuiz({ materialId: material.id, source: 'subject' })}
                  />
                  <Button
                    label={`Manage ${material.title}`}
                    variant="secondary"
                    icon={<ClipboardList size={14} />}
                    isIconOnly
                    onClick={() => onManage(material.id)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
