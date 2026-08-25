import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/importer.types';

interface ExtractionProgressViewProps {
  candidates: ImportCandidate[];
}

export function ExtractionProgressView({ candidates }: ExtractionProgressViewProps) {
  return (
    <div {...stylex.props(importerStyles.content)}>
      <h3>Extracting Content...</h3>
      <div {...stylex.props(importerStyles.fileList)}>
        {candidates.map(c => (
          <div key={c.id} {...stylex.props(importerStyles.fileCard)}>
            <div {...stylex.props(importerStyles.fileInfo)}>
              <div {...stylex.props(importerStyles.fileName)}>{c.filename}</div>
              <div {...stylex.props(importerStyles.statusBadge, c.status === 'extracting' ? importerStyles.statusExtracting : c.status === 'error' ? importerStyles.statusError : importerStyles.statusDone)}>
                {c.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

