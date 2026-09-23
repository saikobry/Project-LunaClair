import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import { ArrowRight, BookOpen, CheckCircle, CheckCircle2 } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { Button } from '../../../shared/ui/Button/Button';

interface ImportResultViewProps {
  createdMaterials: StudyMaterial[];
  onImportAnother: () => void;
  onOpenMaterial?: (materialId: string) => void;
}

/**
 * R1 — study handoff surface.
 *
 * Neutral surface + one celebration badge, the imported materials presented as
 * first-class rows, and a single primary action. The success background/border
 * pair is deliberately gone: `--color-success(-muted)` now only marks the
 * badge and each row's status, where it describes the object rather than
 * colouring the whole card.
 *
 * Row actions are `ghost` so the deck keeps the only `primary` when there is a
 * single material to open; with several materials no deck primary renders, and
 * `Import More Files` stays secondary.
 */
export function ImportResultView({ createdMaterials, onImportAnother, onOpenMaterial }: ImportResultViewProps) {
  const latestMaterial = createdMaterials[0];

  return (
    <div {...stylex.props(importerStyles.content)}>
      <div {...stylex.props(importerStyles.resultContainer)}>
        <div {...stylex.props(importerStyles.successHeader)}>
          <span {...stylex.props(importerStyles.successBadge)}>
            <CheckCircle2 size={26} color="var(--color-success)" />
          </span>
          <h2 {...stylex.props(importerStyles.resultTitle)}>Import Successful</h2>
          <p {...stylex.props(importerStyles.resultSubtitle)}>
            {createdMaterials.length} material{createdMaterials.length === 1 ? '' : 's'} added to your library.
          </p>
        </div>

        {createdMaterials.length > 0 && (
          <div {...stylex.props(importerStyles.resultMaterialList)}>
            {createdMaterials.map((mat) => (
              <div key={mat.id} {...stylex.props(importerStyles.resultMaterialRow)}>
                <span {...stylex.props(importerStyles.resultMaterialIcon)}>
                  <BookOpen size={16} color="var(--color-accent)" />
                </span>
                <div {...stylex.props(importerStyles.resultMaterialInfo)}>
                  <div {...stylex.props(importerStyles.resultMaterialTitle)}>{mat.title}</div>
                  <div {...stylex.props(importerStyles.resultMaterialMeta)}>
                    <CheckCircle size={12} color="var(--color-success)" />
                    <span>Saved to Library</span>
                  </div>
                </div>
                {onOpenMaterial && (
                  <Button
                    variant="ghost"
                    label="Open Material"
                    icon={<ArrowRight size={14} />}
                    onClick={() => onOpenMaterial(mat.id)}
                  >
                    Open Material
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div {...stylex.props(importerStyles.resultActionDeck)}>
          <Button variant="secondary" label="Import More Files" onClick={onImportAnother}>
            Import More Files
          </Button>
          {onOpenMaterial && latestMaterial && createdMaterials.length === 1 && (
            <Button
              variant="primary"
              label="Open in Workspace"
              icon={<ArrowRight size={14} />}
              onClick={() => onOpenMaterial(latestMaterial.id)}
            >
              Open in Workspace
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
