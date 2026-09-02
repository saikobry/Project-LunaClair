import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

interface ImportFileCardProps {
  candidate: ImportCandidate;
  onRemove: (id: string) => void;
}

export function ImportFileCard({ candidate, onRemove }: ImportFileCardProps) {
  return (
    <div {...stylex.props(importerStyles.fileCard)}>
      {candidate.source === 'pdf' ? <FileText /> : <ImageIcon />}
      <div {...stylex.props(importerStyles.fileInfo)}>
        <div {...stylex.props(importerStyles.fileName)}>{candidate.filename}</div>
        <div {...stylex.props(importerStyles.fileMeta)}>
          <span>{(candidate.file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
      <div {...stylex.props(importerStyles.statusBadge, candidate.status === 'pending' ? importerStyles.statusPending : importerStyles.statusDone)}>
        {candidate.status}
      </div>
      <button {...stylex.props(importerStyles.button, importerStyles.buttonGhost)} onClick={() => onRemove(candidate.id)}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
