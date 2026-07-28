import { useState, useMemo, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BrainCircuit, CheckSquare } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library';
import type { Term } from '../../../domain/library';
import { Button } from '../../../shared/ui/Button';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#3d3548',
    margin: 0,
    marginBottom: 12,
  },
  termGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  termHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#f8f7fa',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    ':hover': {
      background: '#ecedf9',
    },
  },
  termTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#3d3548',
    flex: 1,
  },
  selectAll: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: '4px 8px',
    borderRadius: 4,
    ':hover': {
      background: '#ecedf9',
    },
  },
  materialRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px 8px 24px',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    ':hover': {
      background: '#f8f7fa',
    },
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 4,
    border: '2px solid #d1d0d4',
    flexShrink: 0,
    color: 'transparent',
    transition: 'all 0.15s ease',
  },
  checkboxChecked: {
    borderColor: '#6366f1',
    background: '#6366f1',
    color: '#fff',
  },
  materialTitle: {
    fontSize: 14,
    color: '#3d3548',
    flex: 1,
  },
  materialMeta: {
    fontSize: 12,
    color: '#9f95a9',
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 16,
    borderTop: '1px solid #e5e4e7',
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sortedTerms = useMemo(
    () => terms.toSorted((a, b) => a.order - b.order),
    [terms],
  );

  const materialsByTerm = useMemo(() => {
    const map = new Map<string, StudyMaterial[]>();
    for (const term of sortedTerms) {
      const termMaterials = materials.filter((m) => m.termId === term.id);
      if (termMaterials.length > 0) {
        map.set(term.id, termMaterials);
      }
    }
    return map;
  }, [materials, sortedTerms]);

  const toggleMaterial = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleTerm = useCallback(
    (termId: string) => {
      const termMaterials = materialsByTerm.get(termId) ?? [];
      const termIds = termMaterials.map((m) => m.id);
      const allSelected = termIds.every((id) => selectedIds.has(id));

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of termIds) {
          if (allSelected) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    },
    [materialsByTerm, selectedIds],
  );

  const allIds = useMemo(() => materials.map((m) => m.id), [materials]);

  const toggleAll = useCallback(() => {
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return next;
    });
  }, [allIds, selectedIds]);

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
      <div {...stylex.props(styles.termHeader)} onClick={toggleAll} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleAll(); }}>
        <div {...stylex.props(styles.checkbox, allIds.every((id) => selectedIds.has(id)) && styles.checkboxChecked)}>
          <CheckSquare size={14} />
        </div>
        <span {...stylex.props(styles.termTitle)}>Select / Deselect All</span>
        <span {...stylex.props(styles.materialMeta)}>{selectedIds.size} of {allIds.length} selected</span>
      </div>

      {sortedTerms.map((term) => {
        const termMaterials = materialsByTerm.get(term.id) ?? [];
        if (termMaterials.length === 0) return null;

        const allTermSelected = termMaterials.every((m) => selectedIds.has(m.id));

        return (
          <div key={term.id} {...stylex.props(styles.termGroup)}>
            <div
              {...stylex.props(styles.termHeader)}
              onClick={() => toggleTerm(term.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTerm(term.id); }}
            >
              <div {...stylex.props(styles.checkbox, allTermSelected && styles.checkboxChecked)}>
                <CheckSquare size={14} />
              </div>
              <span {...stylex.props(styles.termTitle)}>{term.title}</span>
              <span {...stylex.props(styles.materialMeta)}>{termMaterials.length} chapters</span>
            </div>

            {termMaterials.map((material) => (
              <div
                key={material.id}
                {...stylex.props(styles.materialRow)}
                onClick={() => toggleMaterial(material.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleMaterial(material.id); }}
              >
                <div {...stylex.props(styles.checkbox, selectedIds.has(material.id) && styles.checkboxChecked)}>
                  <CheckSquare size={14} />
                </div>
                <span {...stylex.props(styles.materialTitle)}>{material.title}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div {...stylex.props(styles.actionBar)}>
        <Button
          label="Start Unified Quiz"
          variant="primary"
          icon={<BrainCircuit size={16} />}
          isDisabled={selectedIds.size === 0}
          onClick={() => onStartUnifiedQuiz(Array.from(selectedIds))}
        >
          Start Unified Quiz ({selectedIds.size} {selectedIds.size === 1 ? 'chapter' : 'chapters'})
        </Button>
      </div>
    </div>
  );
}
