import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

interface ImportResultViewProps {
  createdMaterials: StudyMaterial[];
  onImportAnother: () => void;
  onOpenMaterial?: (materialId: string) => void;
}

export function ImportResultView({ createdMaterials, onImportAnother, onOpenMaterial }: ImportResultViewProps) {
  const latestMaterial = createdMaterials[0];

  return (
    <div {...stylex.props(importerStyles.content)}>
      <div {...stylex.props(importerStyles.resultCard)}>
        <CheckCircle2 size={48} color='var(--color-success)' />
        <h3 style={{ margin: 0 }}>Import Successful</h3>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {createdMaterials.length} material{createdMaterials.length === 1 ? '' : 's'} added to your library.
        </p>

        {createdMaterials.length > 0 && (
          <div style={{ width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {createdMaterials.map((mat) => (
              <div
                key={mat.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid var(--color-success-muted)',
                }}
              >
                <div style={{ fontWeight: 500, color: '#111827', fontSize: '14px' }}>{mat.title}</div>
                {onOpenMaterial && (
                  <button
                    type="button"
                    {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)}
                    onClick={() => onOpenMaterial(mat.id)}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Open Material <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)} onClick={onImportAnother}>
            Import More Files
          </button>
          {onOpenMaterial && latestMaterial && createdMaterials.length === 1 && (
            <button
              type="button"
              {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)}
              onClick={() => onOpenMaterial(latestMaterial.id)}
            >
              Open in Workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
