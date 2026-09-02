import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';

interface MaterialDetailsViewProps {
  candidates: ImportCandidate[];
  onUpdateTitle: (id: string, title: string) => void;
  onCommit: () => void;
}

export function MaterialDetailsView({ candidates, onUpdateTitle, onCommit }: MaterialDetailsViewProps) {
  return (
    <div {...stylex.props(importerStyles.content)}>
      <h3>Material Details</h3>
      {candidates.map(c => (
        <div key={c.id} {...stylex.props(importerStyles.formGroup)}>
          <label {...stylex.props(importerStyles.label)}>Title ({c.filename})</label>
          <input
            {...stylex.props(importerStyles.input)}
            value={c.title || ''}
            onChange={(e) => onUpdateTitle(c.id, e.target.value)}
          />
        </div>
      ))}
      <button {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)} onClick={onCommit}>
        Save to Library
      </button>
    </div>
  );
}
