import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Check, X } from 'lucide-react';
import { importerStyles } from '../styles/importer.stylex';
import { computeLineDiff } from '../utils/textDiff';
import { Button } from '../../../shared/ui/Button/Button';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import MarkdownViewer from '../../reader/components/MarkdownViewer';

export interface ImportDiffViewProps {
  diffResult: {
    candidateId: string;
    original: string;
    cleaned: string;
  };
  onReject: () => void;
  onAccept: () => void;
}

type DiffDisplayMode = 'split' | 'unified' | 'preview';

export function ImportDiffView({ diffResult, onReject, onAccept }: ImportDiffViewProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [displayMode, setDisplayMode] = useState<DiffDisplayMode>(() => (isMobile ? 'unified' : 'split'));
  const effectiveMode: DiffDisplayMode = isMobile && displayMode === 'split' ? 'unified' : displayMode;

  const diffSummary = useMemo(
    () => computeLineDiff(diffResult.original, diffResult.cleaned),
    [diffResult.original, diffResult.cleaned],
  );

  return (
    <div {...stylex.props(importerStyles.diffShell)}>
      <div {...stylex.props(importerStyles.diffReviewBar)}>
        <div {...stylex.props(importerStyles.diffReviewRow1)}>
          <div {...stylex.props(importerStyles.diffReviewTitleGroup)}>
            <div {...stylex.props(importerStyles.diffReviewTitle)}>
              <Sparkles size={16} aria-hidden="true" />
              <span>AI Cleanup Diff Comparison</span>
            </div>

            <div {...stylex.props(importerStyles.diffStats)}>
              <span
                {...stylex.props(importerStyles.diffStatAdd)}
                title={`${diffSummary.additions} lines added`}
              >
                +{diffSummary.additions}
              </span>
              <span
                {...stylex.props(importerStyles.diffStatDelete)}
                title={`${diffSummary.deletions} lines removed`}
              >
                -{diffSummary.deletions}
              </span>
            </div>
          </div>

          <SegmentedControl
            value={effectiveMode}
            onChange={(val) => setDisplayMode(val as DiffDisplayMode)}
            size="sm"
            label="Diff view format"
            layout={isMobile ? 'fill' : 'hug'}
          >
            {!isMobile && <SegmentedControlItem value="split" label="Split Diff" />}
            <SegmentedControlItem value="unified" label="Unified Diff" />
            <SegmentedControlItem value="preview" label="Preview" />
          </SegmentedControl>
        </div>

        <div {...stylex.props(importerStyles.diffReviewRow2)}>
          <div {...stylex.props(importerStyles.diffActions)}>
            <Button
              variant="secondary"
              label="Keep Original"
              icon={<X size={15} />}
              onClick={onReject}
            />
            <Button
              variant="primary"
              label="Accept AI Cleaned"
              icon={<Check size={15} />}
              onClick={onAccept}
            />
          </div>
        </div>
      </div>

      <div {...stylex.props(importerStyles.diffViewContainer)}>
        {effectiveMode === 'split' && (
          <div {...stylex.props(importerStyles.diffSplitColumns)}>
            {/* Left: Original */}
            <div {...stylex.props(importerStyles.diffPane)}>
              <div {...stylex.props(importerStyles.diffPaneHeader)}>
                <span>Original Extracted Text</span>
              </div>
              <div {...stylex.props(importerStyles.diffCodeBody)}>
                {diffSummary.splitRows.map((row) => {
                  const item = row.original;
                  if (!item) {
                    return (
                      <div
                        key={`orig-empty-${row.id}`}
                        {...stylex.props(importerStyles.diffLineRow, importerStyles.diffLineRowPlaceholder)}
                      >
                        <span {...stylex.props(importerStyles.diffLineGutter)} />
                        <span {...stylex.props(importerStyles.diffLineMarker)} />
                        <span {...stylex.props(importerStyles.diffLineContent)}>&nbsp;</span>
                      </div>
                    );
                  }
                  const isDel = item.type === 'delete';
                  return (
                    <div
                      key={`orig-${row.id}`}
                      {...stylex.props(
                        importerStyles.diffLineRow,
                        isDel ? importerStyles.diffLineRowDelete : importerStyles.diffLineRowEqual,
                      )}
                    >
                      <span {...stylex.props(importerStyles.diffLineGutter)}>{item.lineNumber}</span>
                      <span {...stylex.props(importerStyles.diffLineMarker)}>{isDel ? '-' : ' '}</span>
                      <span {...stylex.props(importerStyles.diffLineContent)}>{item.text || ' '}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Cleaned */}
            <div {...stylex.props(importerStyles.diffPane)}>
              <div {...stylex.props(importerStyles.diffPaneHeader)}>
                <span>AI Cleaned Structure</span>
              </div>
              <div {...stylex.props(importerStyles.diffCodeBody)}>
                {diffSummary.splitRows.map((row) => {
                  const item = row.cleaned;
                  if (!item) {
                    return (
                      <div
                        key={`clean-empty-${row.id}`}
                        {...stylex.props(importerStyles.diffLineRow, importerStyles.diffLineRowPlaceholder)}
                      >
                        <span {...stylex.props(importerStyles.diffLineGutter)} />
                        <span {...stylex.props(importerStyles.diffLineMarker)} />
                        <span {...stylex.props(importerStyles.diffLineContent)}>&nbsp;</span>
                      </div>
                    );
                  }
                  const isAdd = item.type === 'add';
                  return (
                    <div
                      key={`clean-${row.id}`}
                      {...stylex.props(
                        importerStyles.diffLineRow,
                        isAdd ? importerStyles.diffLineRowAdd : importerStyles.diffLineRowEqual,
                      )}
                    >
                      <span {...stylex.props(importerStyles.diffLineGutter)}>{item.lineNumber}</span>
                      <span {...stylex.props(importerStyles.diffLineMarker)}>{isAdd ? '+' : ' '}</span>
                      <span {...stylex.props(importerStyles.diffLineContent)}>{item.text || ' '}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {effectiveMode === 'unified' && (
          <div {...stylex.props(importerStyles.diffPane)}>
            <div {...stylex.props(importerStyles.diffPaneHeader)}>
              <span>Original Extracted Text ➔ AI Cleaned Structure</span>
            </div>
            <div {...stylex.props(importerStyles.diffCodeBody)}>
              {diffSummary.unifiedLines.map((line) => {
                const isAdd = line.type === 'add';
                const isDel = line.type === 'delete';
                return (
                  <div
                    key={line.id}
                    {...stylex.props(
                      importerStyles.diffLineRow,
                      isAdd
                        ? importerStyles.diffLineRowAdd
                        : isDel
                          ? importerStyles.diffLineRowDelete
                          : importerStyles.diffLineRowEqual,
                    )}
                  >
                    <span {...stylex.props(importerStyles.diffLineGutter)}>
                      {line.originalLineNumber ?? ' '}
                    </span>
                    <span {...stylex.props(importerStyles.diffLineGutter)}>
                      {line.cleanedLineNumber ?? ' '}
                    </span>
                    <span {...stylex.props(importerStyles.diffLineMarker)}>
                      {isAdd ? '+' : isDel ? '-' : ' '}
                    </span>
                    <span {...stylex.props(importerStyles.diffLineContent)}>{line.text || ' '}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {effectiveMode === 'preview' && (
          <div {...stylex.props(importerStyles.diffSplitColumns)}>
            <div {...stylex.props(importerStyles.diffPane)}>
              <div {...stylex.props(importerStyles.diffPaneHeader)}>
                <span>Original Extracted Text</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <MarkdownViewer text={diffResult.original} />
              </div>
            </div>
            <div {...stylex.props(importerStyles.diffPane)}>
              <div {...stylex.props(importerStyles.diffPaneHeader)}>
                <span>AI Cleaned Structure</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                <MarkdownViewer text={diffResult.cleaned} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
