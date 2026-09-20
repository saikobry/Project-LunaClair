import { useState, useCallback, useEffect, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';
import { AiChatDrawerHeader } from './AiChatDrawerHeader';
import { useAiChatThread } from '../hooks/useAiChatThread';
import { AiChatMessageList } from './AiChatMessageList';
import { AiChatHistoryPanel } from './AiChatHistoryPanel';
import { AiChatErrorBanner } from './AiChatErrorBanner';
import { AiSessionMetrics } from './AiSessionMetrics';
import { AiModelPicker } from './AiModelPicker';
import { AiChatInput } from './AiChatInput';
import { useAiModelSelection } from '../hooks/useAiModelSelection';
import { estimateSessionContext } from '../utils/aiSessionMetrics';
import { type AiSelectionAction } from '../utils/selectionActionPrompt';
import { useAiSessionDeletion } from '../hooks/useAiSessionDeletion';
import { useAiSelectionAction } from '../hooks/useAiSelectionAction';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    // Same stacking band as the AddMaterialsDrawer slide-over: above app
    // chrome (header 110, rails 150, collections popover 180) so the panel
    // reads as one top-level surface, below system overlays (OfflineBanner
    // 200, InstallPrompt 300). Dialogs (native top layer) always win.
    zIndex: 185,
    display: 'none',
    [mobile]: {
      display: 'block',
    },
  },
  drawerContainer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 400,
    maxWidth: '100vw',
    backgroundColor: 'var(--color-background-surface)',
    borderLeft: '1px solid var(--color-border)',
    boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    // See backdrop note above — panel sits one step above its backdrop.
    zIndex: 190,
    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    [mobile]: {
      top: 'auto',
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '82vh',
      borderLeft: 'none',
      borderTop: '1px solid var(--color-border)',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)',
    },
  },
  drawerClosed: {
    transform: 'translateX(100%)',
    pointerEvents: 'none',
    [mobile]: {
      transform: 'translateY(100%)',
    },
  },
  drawerOpen: {
    transform: 'translateX(0)',
    pointerEvents: 'auto',
    [mobile]: {
      transform: 'translateY(0)',
    },
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
});

export interface SelectionContext {
  text: string;
  action?: AiSelectionAction;
  sectionHeading?: string;
}

export interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  materialId?: string;
  documentContext?: string;
  selectionContext?: SelectionContext | null;
  onClearSelectionContext?: () => void;
}

export function AiChatDrawer({
  isOpen,
  onClose,
  materialId,
  documentContext,
  selectionContext,
  onClearSelectionContext,
}: AiChatDrawerProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // The workspace behind the drawer must not scroll under it — the drawer is a
  // non-modal overlay with its own backdrop, so nothing else locks the page.
  useBodyScrollLock(isOpen);

  // Which model the next message asks for. Per request, not per conversation: the thread stores no
  // model, so switching here changes the next turn and never the one already streaming.
  const { catalog, selectedModel, selectModel, refreshCatalog } = useAiModelSelection();

  const {
    thread,
    sessions,
    messages,
    isLoading,
    isStreaming,
    activity,
    streamingText,
    sendMessage,
    stopStreaming,
    retryMessage,
    retryLastPrompt,
    dismissError,
    clearHistory,
    startNewSession,
    selectSession,
    deleteSession,
    error,
    cooldownSeconds,
  } = useAiChatThread({ materialId, model: selectedModel.id });

  // The server refused the model this client offered, which means the catalog here is behind the
  // server's (a model was just disabled or retired). The bundled mirror and the cached copy are
  // both offline stand-ins, so the only cure is to re-read the catalog and let the picker reflect
  // what is actually servable — never to retry the refused model.
  useEffect(() => {
    if (error?.code === 'MODEL_UNAVAILABLE') refreshCatalog();
  }, [error?.code, refreshCatalog]);

  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const toggleHistory = useCallback(() => setIsHistoryOpen((open) => !open), []);

  // Confirmation flow for deleting conversations lives in its own hook — the drawer only wires it.
  const {
    dialogCopy,
    requestClearAll,
    requestDeleteSession,
    confirmDeletion,
    cancelDeletion,
  } = useAiSessionDeletion({
    sessions,
    deleteSession,
    clearHistory,
    onCleared: closeHistory,
  });

  // Estimated **once**, against the selected model rather than the default one. Two consumers read
  // it — the send guard below and the meter strip — and computing it in both would mean two walks
  // over the transcript and the document, plus two places to edit whenever the estimator changes.
  const sessionContext = useMemo(
    () =>
      estimateSessionContext({
        messages,
        documentMarkdown: documentContext,
        selectionText: selectionContext?.text,
        modelId: selectedModel.id,
      }),
    [messages, documentContext, selectionContext?.text, selectedModel.id],
  );

  // The guard the picker explains and the composer enforces. Only an overshoot blocks sending — the
  // request has not been refused until it is sent.
  const isOverBudget = sessionContext.estimate.isOverBudget;
  const isSendBlocked = isOverBudget || cooldownSeconds > 0;

  // A turn in flight belongs on the transcript, so the history panel yields the
  // moment one starts. This also covers the reader's contextual Explain /
  // Simplify / Example actions, which send without an event-handler call site of
  // their own. Adjusted during render — React's "adjust state when a value
  // changes" pattern — rather than in an effect, so the panel never paints over
  // the answer that is already streaming behind it.
  const [wasStreaming, setWasStreaming] = useState(isStreaming);
  if (isStreaming !== wasStreaming) {
    setWasStreaming(isStreaming);
    if (isStreaming && isHistoryOpen) setIsHistoryOpen(false);
  }

  // A reader selection (Explain / Simplify / Example, or the reader toolbar) becomes one chat turn
  // and is then cleared. Deduplicated inside the hook, which owns the reader-to-drawer contract.
  useAiSelectionAction({
    isOpen,
    materialId,
    documentContext,
    selectionContext,
    send: sendMessage,
    onHandled: onClearSelectionContext,
  });

  const handleSendPrompt = useCallback(
    (promptText: string) => {
      // A new turn belongs on the transcript, not behind the history panel.
      setIsHistoryOpen(false);
      sendMessage(promptText, {
        documentContext: documentContext
          ? { id: materialId || 'current-doc', markdown: documentContext }
          : undefined,
        selection: selectionContext
          ? {
              text: selectionContext.text,
              surroundingHeading: selectionContext.sectionHeading,
            }
          : undefined,
      });
      if (selectionContext) {
        onClearSelectionContext?.();
      }
    },
    [sendMessage, documentContext, materialId, selectionContext, onClearSelectionContext],
  );

  const handleSelectSession = useCallback(
    (threadId: string) => {
      selectSession(threadId);
      setIsHistoryOpen(false);
    },
    [selectSession],
  );

  const handleNewSession = useCallback(() => {
    startNewSession();
    setIsHistoryOpen(false);
  }, [startNewSession]);

  return (
    <>
      {isOpen && (
        <div
          {...stylex.props(styles.backdrop)}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        {...stylex.props(
          styles.drawerContainer,
          isOpen ? styles.drawerOpen : styles.drawerClosed,
        )}
        aria-label="AI Study Assistant"
        aria-hidden={!isOpen}
      >
        <AiChatDrawerHeader
          title={thread?.title ?? 'AI Study Assistant'}
          sessionCount={sessions.length}
          isHistoryOpen={isHistoryOpen}
          onToggleHistory={toggleHistory}
          onClose={onClose}
        />

        <div {...stylex.props(styles.body)}>
          {isHistoryOpen ? (
            <AiChatHistoryPanel
              sessions={sessions}
              activeThreadId={thread?.id ?? null}
              isStreaming={isStreaming}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              onDeleteSession={requestDeleteSession}
              onClearAll={requestClearAll}
              onClose={() => setIsHistoryOpen(false)}
            />
          ) : (
            <AiChatMessageList
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              streamingText={streamingText}
              activity={activity}
              activeThreadId={thread?.id ?? null}
              onSendMessage={handleSendPrompt}
              onRetryMessage={retryMessage}
            />
          )}

          {error && (
            <AiChatErrorBanner
              message={error.message}
              onRetry={retryLastPrompt}
              onDismiss={dismissError}
            />
          )}

          {/* Conversation totals and the context estimate describe the transcript on screen, so
              they step aside with it while the history panel is showing. */}
          {!isHistoryOpen && (
            <>
              <AiSessionMetrics messages={messages} context={sessionContext} />
              <AiModelPicker
                models={catalog.models}
                selectedModelId={selectedModel.id}
                onSelectModel={selectModel}
                isOverBudget={isOverBudget}
                cooldownSeconds={cooldownSeconds}
              />
            </>
          )}

          <AiChatInput
            onSendMessage={handleSendPrompt}
            onStopGeneration={stopStreaming}
            isStreaming={isStreaming}
            disabled={isLoading}
            isSendBlocked={isSendBlocked}
            selectionExcerpt={selectionContext?.text}
            onClearSelection={onClearSelectionContext}
          />
        </div>
      </aside>

      {/* Mounted only while an action is pending, so the copy is always complete. */}
      {dialogCopy && (
        <ConfirmationDialog
          isOpen
          title={dialogCopy.title}
          message={dialogCopy.message}
          confirmLabel={dialogCopy.confirmLabel}
          intent="danger"
          onConfirm={confirmDeletion}
          onCancel={cancelDeletion}
        />
      )}
    </>
  );
}
