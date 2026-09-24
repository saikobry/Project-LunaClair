import { type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { Banner } from '../../../../shared/ui/Banner/Banner';
import { Button } from '../../../../shared/ui/Button/Button';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';
import { GeneratedBatchHeader } from './GeneratedBatchHeader';

const styles = stylex.create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: 16,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  reviewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    paddingBottom: 8,
    borderBottom: '1px solid var(--color-border)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    gap: 12,
    textAlign: 'center',
  },
});

/** Shared lifecycle of both generator hooks — the shell only maps it to visuals. */
export type AiBatchGeneratorStatus =
  | 'idle'
  | 'generating'
  | 'review'
  | 'saving'
  | 'done'
  | 'error';

/** What the review list is handed: selection controls up-calls and the counts to label them. */
export interface PreviewListRenderProps {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectedCount: number;
  totalCount: number;
}

export interface AiBatchGeneratorShellProps {
  /** Dialog title. */
  title: string;
  /** Lifecycle state from the consumer's generator hook — the shell does NOT own transitions. */
  status: AiBatchGeneratorStatus;
  /** Phase label shown while generating/saving. */
  phaseMessage?: string;
  /** Error text for the error branch. */
  error?: string;
  /** Noun for one generated item, e.g. `question`. */
  singular: string;
  /** Noun for several, e.g. `questions` — also derives generate/accept/done copy. */
  plural: string;
  /** Where accepted items go, shown on the accept button (`Bank` / `Deck`). */
  acceptDestination: string;
  /** `true` when nothing may be sent — disables generate and retry. */
  isAiUnavailable: boolean;
  /** Fallback text when the hook supplied no error message. */
  errorFallback: string;
  /** Done-branch description — the consumer owns the saved-count copy. */
  doneDescription: ReactNode;
  /** Idle-branch content: intro, model control, config fields. */
  configPanel: ReactNode;
  /** Review-branch list rendering; the shell owns the header and selection controls. */
  renderPreviewList: (props: PreviewListRenderProps) => ReactNode;
  /** Review-header counts. */
  totalCount: number;
  selectedCount: number;
  rejectedCount: number;
  /** Starts a (re)generation — called by the idle Generate and error Retry buttons. */
  onGenerate: () => void;
  /** Accepts the selected drafts — review-branch primary action. */
  onAccept: () => void;
  /** Returns to the idle config — review-branch Back. */
  onBack: () => void;
  /** Cancels/closes — Cancel and Done. */
  onClose: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Controlled shell for the AI batch generator dialogs (questions, flashcards).
 *
 * The consumer's hook owns the status machine; this shell owns only the
 * VISUAL mapping — which branch renders, which buttons show — so it never
 * disagrees with the hook. It branches on `status` (a shared lifecycle
 * concept), never on the generated content type, which is what keeps it a
 * composition surface instead of a `<T>`-parameterized component: the config
 * panel and preview list arrive as opaque slots.
 *
 * The footer is deliberately NOT a slot — both dialogs share it verbatim
 * apart from noun copy. If a future consumer needs different footer actions,
 * extract a `footerActions` slot then, not preemptively.
 */
export function AiBatchGeneratorShell({
  title,
  status,
  phaseMessage,
  error,
  singular,
  plural,
  acceptDestination,
  isAiUnavailable,
  errorFallback,
  doneDescription,
  configPanel,
  renderPreviewList,
  totalCount,
  selectedCount,
  rejectedCount,
  onGenerate,
  onAccept,
  onBack,
  onClose,
  onSelectAll,
  onDeselectAll,
}: AiBatchGeneratorShellProps) {
  const isGenerating = status === 'generating' || status === 'saving';
  const generateLabel = `Generate ${capitalize(plural)}`;
  const acceptLabel = `Add ${selectedCount} ${capitalize(plural)} to ${acceptDestination}`;

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={title}
      width={680}
      footer={
        <div {...stylex.props(styles.footer)}>
          {status === 'idle' && (
            <>
              <Button label="Cancel" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                label={generateLabel}
                variant="primary"
                onClick={onGenerate}
                isDisabled={isAiUnavailable}
              >
                <Sparkles size={14} style={{ marginRight: 6 }} />
                {generateLabel}
              </Button>
            </>
          )}

          {status === 'review' && (
            <>
              <Button label="Back" variant="secondary" onClick={onBack}>
                Back
              </Button>
              <Button
                label={acceptLabel}
                variant="primary"
                onClick={onAccept}
                isDisabled={selectedCount === 0}
              >
                {acceptLabel}
              </Button>
            </>
          )}

          {status === 'done' && (
            <Button label="Done" variant="primary" onClick={onClose}>
              Done
            </Button>
          )}

          {status === 'error' && (
            <>
              <Button label="Cancel" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                label="Retry Generation"
                variant="primary"
                onClick={onGenerate}
                isDisabled={isAiUnavailable}
              >
                Retry Generation
              </Button>
            </>
          )}
        </div>
      }
    >
      <div {...stylex.props(styles.body)}>
        {status === 'idle' && configPanel}

        {isGenerating && (
          <div {...stylex.props(styles.loadingContainer)}>
            <Loader2 size={32} className="lucide-spin" color="var(--color-accent)" />
            <div {...stylex.props(styles.loadingText)}>{phaseMessage || 'Generating...'}</div>
          </div>
        )}

        {status === 'error' && <Banner variant="error" title={error || errorFallback} />}

        {status === 'review' && (
          <>
            <div {...stylex.props(styles.reviewHeader)}>
              <GeneratedBatchHeader
                generatedCount={totalCount}
                selectedCount={selectedCount}
                rejectedCount={rejectedCount}
                singular={singular}
                plural={plural}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button label="Select All" variant="secondary" onClick={onSelectAll}>
                  Select All
                </Button>
                <Button label="Deselect All" variant="secondary" onClick={onDeselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            {renderPreviewList({ onSelectAll, onDeselectAll, selectedCount, totalCount })}
          </>
        )}

        {status === 'done' && (
          <div {...stylex.props(styles.successContainer)}>
            <CheckCircle2 size={40} color="var(--color-success)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {capitalize(plural)} Saved!
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {doneDescription}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
