import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate, ExtractionProgress } from '../../../domain/importer/models/importer.types';
import { Button } from '../../../shared/ui/Button/Button';
import { ImportStatusBadge } from './ImportStatusBadge';

interface ExtractionProgressViewProps {
  candidates: ImportCandidate[];
  progressMap?: Record<string, ExtractionProgress>;
  onCancel?: () => void;
}

export function ExtractionProgressView({
  candidates,
  progressMap,
  onCancel,
}: ExtractionProgressViewProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = () => {
    if (isCancelling) return;
    setIsCancelling(true);
    onCancel?.();
  };

  const completedCount = candidates.filter(
    (c) => c.status === 'done' || c.status === 'review',
  ).length;

  return (
    <div {...stylex.props(importerStyles.content)}>
      <div {...stylex.props(importerStyles.extractionViewHeader)}>
        <div {...stylex.props(importerStyles.extractionHeaderInfo)}>
          <h3 {...stylex.props(importerStyles.extractionTitle)}>Extracting Content...</h3>
          <p {...stylex.props(importerStyles.extractionSubtitle)}>
            Processing documents and extracting text, tables, and figures.
          </p>
          {candidates.length > 1 && (
            <span {...stylex.props(importerStyles.extractionCounterBadge)}>
              {completedCount} of {candidates.length} files processed
            </span>
          )}
        </div>
      </div>

      <div {...stylex.props(importerStyles.fileList)}>
        {candidates.map((c) => {
          const progress = progressMap?.[c.id];
          const isExtracting = c.status === 'extracting';
          const isCooldown = progress?.phase === 'cooldown';
          const isAiVision = progress?.phase === 'ai-vision';
          const isDone = c.status === 'done' || c.status === 'review';
          const isError = c.status === 'error';
          const percent = isDone ? 100 : Math.min(100, Math.max(0, progress?.percent ?? 0));

          const fileSizeMb =
            c.file && c.file.size > 0
              ? `${(c.file.size / (1024 * 1024)).toFixed(2)} MB`
              : undefined;

          return (
            <div
              key={c.id}
              {...stylex.props(
                importerStyles.fileCard,
                importerStyles.extractionCard,
                isExtracting && importerStyles.extractionCardActive,
              )}
            >
              <div
                {...stylex.props(
                  importerStyles.fileIconTile,
                  isExtracting && importerStyles.fileIconTileActive,
                )}
                aria-hidden="true"
              >
                {c.source === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />}
              </div>

              <div {...stylex.props(importerStyles.fileInfo)}>
                <div {...stylex.props(importerStyles.extractionCardHeader)}>
                  <div {...stylex.props(importerStyles.fileName)} title={c.filename}>
                    {c.filename}
                  </div>
                  <ImportStatusBadge status={c.status} />
                </div>

                <div {...stylex.props(importerStyles.fileMeta)}>
                  <span>{c.source === 'pdf' ? 'PDF Document' : 'Image File'}</span>
                  {fileSizeMb && <span>• {fileSizeMb}</span>}
                  {progress?.total && progress.total > 1 && (
                    <span>• {progress.total} pages</span>
                  )}
                </div>

                {isError && c.error && (
                  <div {...stylex.props(importerStyles.fileErrorText)}>
                    <AlertTriangle size={13} aria-hidden="true" />
                    <span>{c.error.message}</span>
                  </div>
                )}

                {(progress || isExtracting || isDone) && !isError && (
                  <>
                    <div {...stylex.props(importerStyles.extractionProgressMeta)}>
                      <div
                        data-phase={progress?.phase || (isExtracting ? 'extracting' : undefined)}
                        {...stylex.props(
                          importerStyles.phaseIndicator,
                          isCooldown && importerStyles.phaseIndicatorCooldown,
                          isAiVision && importerStyles.phaseIndicatorVision,
                          isExtracting && importerStyles.phaseIndicatorExtracting,
                        )}
                      >
                        {isCooldown ? (
                          <Clock size={12} aria-hidden="true" />
                        ) : isAiVision ? (
                          <Sparkles size={12} aria-hidden="true" />
                        ) : isDone ? (
                          <CheckCircle2 size={12} aria-hidden="true" />
                        ) : isExtracting ? (
                          <Loader2
                            size={12}
                            {...stylex.props(importerStyles.iconSpin)}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span>
                          {progress?.pageLabel ||
                            (isDone
                              ? 'Extraction complete'
                              : isExtracting
                              ? 'Extracting content...'
                              : '')}
                        </span>
                      </div>
                      <span {...stylex.props(importerStyles.progressPercent)}>
                        {percent}%
                      </span>
                    </div>

                    <div {...stylex.props(importerStyles.progressContainer)}>
                      <div
                        {...stylex.props(importerStyles.progressBar)}
                        style={{
                          width: `${percent}%`,
                          backgroundColor: isCooldown
                            ? 'var(--color-warning)'
                            : isAiVision
                            ? 'var(--color-accent)'
                            : undefined,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onCancel && (
        <div {...stylex.props(importerStyles.extractionFooter)}>
          <Button
            variant="secondary"
            label={isCancelling ? 'Cancelling...' : 'Cancel Extraction'}
            isDisabled={isCancelling}
            onClick={handleCancel}
          />
        </div>
      )}
    </div>
  );
}
