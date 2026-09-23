import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { FileText, Image as ImageIcon, Trash2, Eye, RotateCcw } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';
import { ImportStatusBadge } from './ImportStatusBadge';

interface ImportFileCardProps {
  candidate: ImportCandidate;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onReview?: (id: string) => void;
}

function CandidateFileIcon({ source }: { source: 'pdf' | 'image' }) {
  return source === 'pdf' ? <FileText size={20} /> : <ImageIcon size={20} />;
}

function PartialExtractionMeta({
  isPartial,
  partialPages,
  totalPages,
}: {
  isPartial: boolean;
  partialPages: number;
  totalPages: number;
}) {
  if (!isPartial || partialPages <= 0) return null;
  const countLabel = totalPages > 0 ? ` of ${totalPages}` : '';
  return <span>• Partial ({partialPages}{countLabel} pages)</span>;
}

function ReviewActionButton({
  candidateId,
  status,
  isPartial,
  onReview,
}: {
  candidateId: string;
  status: ImportCandidate['status'];
  isPartial: boolean;
  onReview?: (id: string) => void;
}) {
  if (!onReview || (status !== 'review' && status !== 'done')) return null;
  const label = isPartial ? 'Review Partial' : 'Review';
  return (
    <Button
      variant="secondary"
      label={label}
      icon={<Eye size={14} />}
      onClick={() => onReview(candidateId)}
    >
      {label}
    </Button>
  );
}

function RetryActionButton({
  candidateId,
  status,
  isPartial,
  onRetry,
}: {
  candidateId: string;
  status: ImportCandidate['status'];
  isPartial: boolean;
  onRetry?: (id: string) => void;
}) {
  if (!onRetry || (status !== 'error' && status !== 'review')) return null;
  const label = status === 'review' && !isPartial ? 'Re-extract' : 'Retry';
  return (
    <Button
      variant="secondary"
      label={label}
      icon={<RotateCcw size={14} />}
      onClick={() => onRetry(candidateId)}
    >
      {label}
    </Button>
  );
}

export function ImportFileCard({
  candidate,
  onRemove,
  onRetry,
  onReview,
}: ImportFileCardProps) {
  const isPartial = Boolean(candidate.extraction?.isPartial);
  const partialPages = candidate.extraction?.pages.length ?? 0;
  const totalPages = candidate.extraction?.pageCount ?? 0;
  const fileSizeMb = (candidate.file.size / 1024 / 1024).toFixed(2);

  return (
    <div {...stylex.props(importerStyles.fileCard)}>
      <div {...stylex.props(importerStyles.fileMain)}>
        <div {...stylex.props(importerStyles.fileIconTile)} aria-hidden="true">
          <CandidateFileIcon source={candidate.source} />
        </div>
        <div {...stylex.props(importerStyles.fileInfo)}>
          <div {...stylex.props(importerStyles.fileName)} title={candidate.filename}>
            {candidate.filename}
          </div>
          <div {...stylex.props(importerStyles.fileMeta)}>
            <span>{fileSizeMb} MB</span>
            <PartialExtractionMeta
              isPartial={isPartial}
              partialPages={partialPages}
              totalPages={totalPages}
            />
          </div>
        </div>
        <div {...stylex.props(importerStyles.fileBadge)}>
          <ImportStatusBadge status={candidate.status} isPartial={isPartial} />
        </div>
      </div>
      <div {...stylex.props(importerStyles.fileActions)}>
        <ReviewActionButton
          candidateId={candidate.id}
          status={candidate.status}
          isPartial={isPartial}
          onReview={onReview}
        />
        <RetryActionButton
          candidateId={candidate.id}
          status={candidate.status}
          isPartial={isPartial}
          onRetry={onRetry}
        />
        <Button
          variant="danger"
          isIconOnly
          label="Remove file"
          icon={<Trash2 size={16} />}
          onClick={() => onRemove(candidate.id)}
        />
      </div>
    </div>
  );
}
