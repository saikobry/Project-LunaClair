import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Eye, BrainCircuit, ClipboardList } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library';
import type { Term } from '../../../domain/library';
import { Card } from '../../../shared/ui/Card';
import { Button } from '../../../shared/ui/Button';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  filters: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterChip: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #e5e4e7',
    background: '#fff',
    color: '#6b6375',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      borderColor: '#6366f1',
      color: '#6366f1',
    },
  },
  filterChipActive: {
    background: '#6366f1',
    borderColor: '#6366f1',
    color: '#fff',
    ':hover': {
      background: '#5558e6',
      color: '#fff',
    },
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
    color: '#3d3548',
    margin: 0,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6b6375',
    margin: 0,
    lineHeight: 1.4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#9f95a9',
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
    color: '#9f95a9',
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

  const sortedTerms = useMemo(
    () => terms.toSorted((a, b) => a.order - b.order),
    [terms],
  );

  const filteredMaterials = useMemo(() => {
    if (!activeFilter) return materials;
    return materials.filter((m) => m.termId === activeFilter);
  }, [materials, activeFilter]);

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.filters)}>
        <button
          type="button"
          {...stylex.props(styles.filterChip, activeFilter === null && styles.filterChipActive)}
          onClick={() => setActiveFilter(null)}
        >
          All
        </button>
        {sortedTerms.map((term) => (
          <button
            key={term.id}
            type="button"
            {...stylex.props(styles.filterChip, activeFilter === term.id && styles.filterChipActive)}
            onClick={() => setActiveFilter(term.id)}
          >
            {term.title}
          </button>
        ))}
      </div>

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
                <div {...stylex.props(styles.cardMeta)}>
                  {material.sourceType}
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
