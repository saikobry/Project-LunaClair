import * as stylex from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import type { useTermGroupedSelection } from '../../hooks/useTermGroupedSelection';
import type { StudyMaterial, Term } from '../../../../domain/library';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  termGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  termHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
    paddingLeft: 0,
    paddingRight: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
  },
  termTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--color-text-secondary)',
  },
  toggleButton: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    color: 'var(--color-accent)',
    cursor: 'pointer',
    outlineStyle: 'none',
    outlineWidth: 0,
    boxShadow: 'none',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  materialList: {
    display: 'flex',
    flexDirection: 'column',
  },
  materialRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 8,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-element, 6px)',
    transition: 'background-color 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'var(--color-border-emphasized)',
    flexShrink: 0,
    color: 'transparent',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  checkboxChecked: {
    borderColor: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent)',
    color: '#ffffff',
  },
  materialTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  materialSubtitle: {
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    textTransform: 'capitalize',
  },
});

export interface TermGroupedSelectorProps {
  materials: StudyMaterial[];
  terms: Term[];
  selection: ReturnType<typeof useTermGroupedSelection>;
}

export function TermGroupedSelector({
  selection,
}: TermGroupedSelectorProps) {
  const { terms: sortedTerms, materialsByTerm, selectedIds, toggleMaterial, toggleTerm } = selection;

  return (
    <div {...stylex.props(styles.container)}>
      {sortedTerms.map((term) => {
        const termMaterials = materialsByTerm.get(term.id) ?? [];
        if (termMaterials.length === 0) return null;

        const allTermSelected = termMaterials.every((m) => selectedIds.has(m.id));

        return (
          <div key={term.id} {...stylex.props(styles.termGroup)}>
            <div {...stylex.props(styles.termHeader)}>
              <span {...stylex.props(styles.termTitle)}>{term.title}</span>
              <button
                type="button"
                {...stylex.props(styles.toggleButton)}
                onClick={() => toggleTerm(term.id)}
              >
                {allTermSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div {...stylex.props(styles.materialList)}>
              {termMaterials.map((material) => {
                const isSelected = selectedIds.has(material.id);
                return (
                  <div
                    key={material.id}
                    {...stylex.props(styles.materialRow)}
                    onClick={() => toggleMaterial(material.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleMaterial(material.id);
                      }
                    }}
                  >
                    <div {...stylex.props(styles.checkbox, isSelected && styles.checkboxChecked)}>
                      <Check size={13} strokeWidth={2.5} color="currentColor" />
                    </div>
                    <div {...stylex.props(styles.materialTextContainer)}>
                      <span {...stylex.props(styles.materialTitle)}>{material.title}</span>
                      <span {...stylex.props(styles.materialSubtitle)}>
                        {material.sourceType || 'Local'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
