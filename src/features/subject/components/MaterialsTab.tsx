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
    lineHeight: 1.3,
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  cardBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
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
            const termTitle = material.termId ? termMap.get(material.termId) : null;
            return (
              <Card key={material.id}>
                <div {...stylex.props(styles.cardContent)}>
                  <h3 {...stylex.props(styles.cardTitle)}>{material.title}</h3>
                  {material.description && (
                    <p {...stylex.props(styles.cardDescription)}>{material.description}</p>
                  )}
                  <div {...stylex.props(styles.cardBadges)}>
                    {termTitle && <Chip variant="accent">{termTitle}</Chip>}
                    <Chip variant="neutral">{material.sourceType}</Chip>
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
          );
        })}
        </div>
      )}
    </div>
  );
}
