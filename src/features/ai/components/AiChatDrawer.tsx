import { useState, useCallback, useEffect, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock';
import { AiChatDrawerHeader } from './AiChatDrawerHeader';
import { useAiChatThread } from '../hooks/useAiChatThread';
import { AiChatMessageList } from './AiChatMessageList';
import { AiChatHistoryPanel } from './AiChatHistoryPanel';
import { AiChatErrorBanner } from './AiChatErrorBanner';
import { AiChatDrawerComposer } from './AiChatDrawerComposer';
import { useAiModelSelection } from '../hooks/useAiModelSelection';
import { useAiSelectionThreadMode } from '../hooks/queries/useAiSelectionThreadMode';
import { estimateSessionContext } from '../utils/aiSessionMetrics';
import { type AiSelectionAction } from '../utils/selectionActionPrompt';
import { useAiSessionDeletion } from '../hooks/useAiSessionDeletion';
import { useAiSelectionAction } from '../hooks/useAiSelectionAction';
import { useAiGroundingContext } from '../hooks/queries/useAiGroundingContext';
import type { AiGroundingTarget } from '../../../application/use-cases/ai/AiGroundingResolver';

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
  selectionContext?: SelectionContext | null;
  onClearSelectionContext?: () => void;
}

export function AiChatDrawer({
  isOpen,
  onClose,
  materialId,
  selectionContext,
  onClearSelectionContext,
}: AiChatDrawerProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // The workspace behind the drawer must not scroll under it — the drawer is a
  // non-modal overlay with its own backdrop, so nothing else locks the page.
  useBodyScrollLock(isOpen);

  // Which model the next message asks for. Per request, not per conversation: the thread stores no
  // model, so switching here changes the next turn and never the one already streaming.
  const modelSelection = useAiModelSelection();
  const { selectedModel, refreshCatalog } = modelSelection;

  // Where selection actions reply: the newest conversation, or a distinct one.
  // Device-local preference, shared with the Settings surface. Its load gates
  // the selection dispatch below: the hook falls back to 'latest' before the
  // stored value arrives, and sending on the fallback would ignore a stored
  // 'new' — the same settle-before-send rule as the session itself.
  const { threadMode, isLoading: isThreadModeLoading } = useAiSelectionThreadMode();

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
    grounding,
    draftGrounding,
    setGrounding,
  } = useAiChatThread({ materialId, model: selectedModel?.id });

  // Grounding target: resolves from the active persisted thread or the current draft state.
  const groundingTarget = useMemo<AiGroundingTarget | null>(() => {
    if (thread) return { threadId: thread.id };
    if (materialId) return { materialId, grounding: draftGrounding };
    return null;
  }, [thread, materialId, draftGrounding]);

  const groundingQuery = useAiGroundingContext(groundingTarget, {
    model: selectedModel?.id,
    enabled: isOpen && materialId !== undefined,
  });

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
        documentCharacters: materialId !== undefined ? groundingQuery.data?.documentCharacters : 0,
        isIndeterminate:
          materialId !== undefined ? (groundingQuery.isLoading || groundingQuery.isError) : false,
        selectionText: selectionContext?.text,
        modelId: selectedModel?.id,
      }),
    [
      messages,
      materialId,
      groundingQuery.data?.documentCharacters,
      groundingQuery.isLoading,
      groundingQuery.isError,
      selectionContext?.text,
      selectedModel?.id,
    ],
  );

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

  /**
   * The one send path, guarded by "is there anything legitimate to send on".
   *
   * The composer blocks itself, but the reader's Explain/Simplify/Example actions call `send`
   * directly, so the guard has to live on the function rather than on the input.
   */
  const sendIfAvailable = useCallback(
    async (content: string, options?: Parameters<typeof sendMessage>[1]) => {
      if (selectedModel === null) return;
      await sendMessage(content, options);
    },
    [selectedModel, sendMessage],
  );

  // A reader selection (Explain / Simplify / Example, or the reader toolbar) becomes one chat turn
  // and is then cleared. Deduplicated inside the hook, which owns the reader-to-drawer contract.
  // The dispatch waits for the session to settle and clears only once the turn is on the
  // transcript, so a mount-time abort cannot orphan an empty session with the request already
  // forgotten.
  useAiSelectionAction({
    isOpen,
    ready: !isLoading && !isThreadModeLoading,
    selectionContext,
    messages,
    forceNewThread: threadMode === 'new',
    send: sendIfAvailable,
    onHandled: onClearSelectionContext,
  });

  const handleSendPrompt = useCallback(
    (promptText: string) => {
      // A new turn belongs on the transcript, not behind the history panel.
      setIsHistoryOpen(false);
      void sendIfAvailable(promptText, {
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
    [sendIfAvailable, selectionContext, onClearSelectionContext],
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

          {/* Totals, the model choice, and the composer — one strip, so the guard the picker
              explains and the composer enforces cannot drift apart. */}
          <AiChatDrawerComposer
            isVisible={!isHistoryOpen}
            messages={messages}
            context={sessionContext}
            model={modelSelection}
            cooldownSeconds={cooldownSeconds}
            isStreaming={isStreaming}
            isLoading={isLoading}
            selectionExcerpt={selectionContext?.text}
            onSendMessage={handleSendPrompt}
            onStopGeneration={stopStreaming}
            onClearSelection={onClearSelectionContext}
            materialId={materialId}
            grounding={grounding}
            onSetGrounding={setGrounding}
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
