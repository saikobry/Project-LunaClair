import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { BookOpen } from 'lucide-react';
import { Input } from '../../../shared/ui/Input/Input';

interface MaterialDetailsViewProps {
  candidates: ImportCandidate[];
  onUpdateTitle: (id: string, title: string) => void;
}

function formatSizeMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Word count is reported from the extraction stats when they exist and estimated
 * from the (possibly hand-edited) markdown otherwise, so the number reflects the
 * document the user is about to save rather than a stale pre-edit figure.
 */
function estimateWordCount(candidate: ImportCandidate): number {
  const extracted = candidate.extraction?.stats.wordCount;
  if (typeof extracted === 'number') return extracted;
  const text = candidate.markdown?.trim() ?? '';
  if (!text) return 0;
  // Whitespace tokens that carry a letter or a digit — markdown markers (`#`,
  // `-`, `|`) are punctuation, not words.
  return text.split(/\s+/).filter(token => /[\p{L}\p{N}]/u.test(token)).length;
}

export function MaterialDetailsView({ candidates, onUpdateTitle }: MaterialDetailsViewProps) {
  return (
    <div {...stylex.props(importerStyles.content)}>
      <h3 {...stylex.props(importerStyles.detailsHeading)}>Material Details</h3>
      <p {...stylex.props(importerStyles.detailsSubtitle)}>
        Review metadata and customize how your materials will appear in your library.
      </p>
      {candidates.map(candidate => {
        const wordCount = estimateWordCount(candidate);
        const pageCount = candidate.extraction?.pageCount ?? 0;

        return (
          <div key={candidate.id} {...stylex.props(importerStyles.detailsCard)}>
            <div {...stylex.props(importerStyles.detailsCardHeader)}>
              <span {...stylex.props(importerStyles.detailsCardIcon)} aria-hidden="true">
                <BookOpen size={16} />
              </span>
              <div {...stylex.props(importerStyles.detailsCardInfo)}>
                <div {...stylex.props(importerStyles.detailsCardFilename)}>
                  {candidate.filename}
                </div>
                <div {...stylex.props(importerStyles.detailsCardMeta)}>
                  <span>{formatSizeMb(candidate.file.size)}</span>
                  {wordCount > 0 && (
                    <span>
                      {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
                    </span>
                  )}
                  {pageCount > 0 && (
                    <span>
                      {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div {...stylex.props(importerStyles.detailsDivider)} aria-hidden="true" />
            <Input
              label="Material Title"
              value={candidate.title || ''}
              placeholder="Enter material title..."
              aria-label={`Material Title for ${candidate.filename}`}
              onChange={val => onUpdateTitle(candidate.id, val)}
            />
            <span {...stylex.props(importerStyles.detailsHint)}>
              Displayed in your library, search, and study sessions
            </span>
          </div>
        );
      })}
    </div>
  );
}
