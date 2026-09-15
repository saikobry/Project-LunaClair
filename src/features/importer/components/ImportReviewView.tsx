import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Loader2 } from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { WriterEditor } from '../../writer/components/WriterEditor';
import MarkdownViewer from '../../reader/components/MarkdownViewer';
import { useAiCleanup } from '../hooks/useAiCleanup';

interface ImportReviewViewProps {
  candidates: ImportCandidate[];
  activeIndex: number;
  onUpdateMarkdown: (id: string, markdown: string) => void;
}

export function ImportReviewView({ candidates, activeIndex, onUpdateMarkdown }: ImportReviewViewProps) {
  const activeCandidate = candidates[activeIndex];
  const [markdown, setMarkdown] = useState(activeCandidate?.markdown || '');
  const { isCleaning, diffResult, error, cleanWithAi, acceptCleanup, rejectCleanup } = useAiCleanup();

  if (!activeCandidate) return null;

  const handleTriggerAiCleanup = async () => {
    await cleanWithAi(markdown, activeCandidate.title);
  };

  const handleAcceptCleanup = () => {
    const cleaned = acceptCleanup();
    if (cleaned) {
      setMarkdown(cleaned);
      onUpdateMarkdown(activeCandidate.id, cleaned);
    }
  };

  return (
    <div {...stylex.props(importerStyles.reviewLayout)}>
      <div {...stylex.props(importerStyles.reviewLeft)}>
        <h4>Files</h4>
        {candidates.map(c => (
          <div key={c.id} style={{ padding: '8px', borderRadius: '4px', backgroundColor: c.id === activeCandidate.id ? 'var(--color-accent-muted)' : 'transparent', fontWeight: c.id === activeCandidate.id ? 600 : 400 }}>
            {c.filename}
          </div>
        ))}
      </div>
      <div {...stylex.props(importerStyles.reviewCenter)}>
        <div {...stylex.props(importerStyles.toolbar)}>
          <span>Edit Content</span>
          <button
            type="button"
            {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)}
            onClick={handleTriggerAiCleanup}
            disabled={isCleaning}
          >
            {isCleaning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Cleaning with AI...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                AI Cleanup
              </>
            )}
          </button>
        </div>
        {error && (
          <div style={{ color: '#dc2626', padding: '8px 16px', fontSize: '13px', backgroundColor: '#fee2e2' }}>
            {error}
          </div>
        )}
        <WriterEditor
          initialMarkdown={markdown}
          onChange={(md) => {
            setMarkdown(md);
            onUpdateMarkdown(activeCandidate.id, md);
          }}
        />
      </div>
      <div {...stylex.props(importerStyles.reviewRight)}>
        <div {...stylex.props(importerStyles.toolbar)}>
          <span>Live Rendered Preview</span>
        </div>
        <MarkdownViewer text={markdown} />
      </div>

      {diffResult && (
        <div {...stylex.props(importerStyles.diffModal)}>
          <div {...stylex.props(importerStyles.diffCard)}>
            <div {...stylex.props(importerStyles.diffHeader)}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--color-accent)" /> AI Cleanup Diff Comparison
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)}
                  onClick={rejectCleanup}
                >
                  Keep Original
                </button>
                <button
                  type="button"
                  {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)}
                  onClick={handleAcceptCleanup}
                >
                  Accept AI Cleaned
                </button>
              </div>
            </div>
            <div {...stylex.props(importerStyles.diffContent)}>
              <div {...stylex.props(importerStyles.diffPane)}>
                <h4 style={{ marginTop: 0, color: '#6b7280' }}>Original Extracted Text</h4>
                <MarkdownViewer text={diffResult.original} />
              </div>
              <div {...stylex.props(importerStyles.diffPane)}>
                <h4 style={{ marginTop: 0, color: 'var(--color-accent)' }}>AI Cleaned Structure</h4>
                <MarkdownViewer text={diffResult.cleaned} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
