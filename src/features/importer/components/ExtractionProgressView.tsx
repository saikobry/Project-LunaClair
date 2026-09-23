import * as stylex from '@stylexjs/stylex';
import { Loader2, Clock, Sparkles } from 'lucide-react';
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
  return (
    <div {...stylex.props(importerStyles.content)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Extracting Content...</h3>
        {onCancel && (
          <Button variant="secondary" label="Cancel Extraction" onClick={onCancel} />
        )}
      </div>
      <div {...stylex.props(importerStyles.fileList)}>
        {candidates.map(c => {
          const progress = progressMap?.[c.id];
          const isCooldown = progress?.phase === 'cooldown';
          const isAiVision = progress?.phase === 'ai-vision';

          return (
            <div key={c.id} {...stylex.props(importerStyles.fileCard)}>
              <div {...stylex.props(importerStyles.fileInfo)}>
                <div {...stylex.props(importerStyles.fileName)}>{c.filename}</div>
                {progress?.pageLabel && (
                  <div
                    data-phase={progress.phase}
                    style={{
                      fontSize: '12px',
                      color: isCooldown
                        ? 'var(--color-warning)'
                        : isAiVision
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '2px',
                      fontWeight: isAiVision ? 500 : undefined,
                    }}
                  >
                    {isCooldown ? (
                      <Clock size={12} />
                    ) : isAiVision ? (
                      <Sparkles size={12} />
                    ) : c.status === 'extracting' ? (
                      <Loader2 size={12} {...stylex.props(importerStyles.iconSpin)} aria-hidden="true" />
                    ) : null}
                    <span>{progress.pageLabel}</span>
                  </div>
                )}
                {progress && (
                  <div {...stylex.props(importerStyles.progressContainer)}>
                    <div
                      {...stylex.props(importerStyles.progressBar)}
                      style={{
                        width: `${progress.percent}%`,
                        backgroundColor: isCooldown
                          ? 'var(--color-warning)'
                          : isAiVision
                          ? 'var(--color-accent)'
                          : undefined,
                      }}
                    />
                  </div>
                )}
              </div>
              <ImportStatusBadge status={c.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
