import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { Banner } from '../../../shared/ui/Banner/Banner';
import { Button } from '../../../shared/ui/Button/Button';
import { useQuizCanvasEditor } from './hooks/useQuizCanvasEditor';
import { QuizCanvasBankImportDialog } from './QuizCanvasBankImportDialog';
import { QuizCanvasHeader } from './QuizCanvasHeader';
import { QuizCanvasQuestionList } from './QuizCanvasQuestionList';

const styles = stylex.create({
    // Dedicated screen route: fills the app shell <main> area while the
    // global sidebar stays visible and interactive. The canvas body
    // (`QuizCanvasQuestionList`) scrolls internally.
    workspace: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        backgroundColor: 'var(--color-background-surface)',
        // WINDOW-SCROLL mode (migrated from the internal-scroller design):
        // the workspace GROWS with content and the DOCUMENT scrolls — the
        // quiz canvas route now behaves like every other route in the app
        // (native scrollbar, mobile URL-bar collapse). The header wrap is
        // `position: sticky` (`headerWrap`) so Back/Save stay reachable, and
        // the toolbar lane pins against the VIEWPORT box (top edge = sticky
        // header height via `topInset`, bottom edge = `innerHeight −
        // bottomInset`). The `.canvas` child has no scroller styles anymore.
    },
    // Sticky header wrap — sticky must sit HERE (not on `<header>` inside):
    // an element only sticks within its containing block, and this wrap's
    // parent is the tall scrolling workspace, while the header's parent (this
    // wrap) is exactly its own height. The wrap also carries the z-index that
    // keeps the stuck bar above the toolbar lane's pinned wrapper (zIndex 30)
    // and the mobile pill (149) — the pinned toolbar locks BELOW it, never
    // over it. `flexShrink: 0` keeps the wrap from collapsing inside the
    // workspace column.
    headerWrap: {
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
});

function formatDraftTime(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface QuizCanvasBuilderProps {
    materialId: string;
    /** Present when editing an existing catalog quiz. */
    quizId?: string;
    onClose: () => void;
    /**
     * Height (px) of app chrome overlapping the canvas's bottom edge (the
     * shell's mobile bottom nav, ≤768px) — forwarded to the toolbar lane so
     * its bottom-pin bound / unpin gate stay above the bar.
     */
    bottomInset?: number;
}

/**
 * Google Forms-style quiz authoring workspace, rendered as a dedicated
 * `quiz-canvas` screen route that occupies the app shell <main> area
 * (not a modal overlay), so the global sidebar stays visible and Focus
 * Mode can be toggled while editing.
 *
 * Thin shell: owns the workspace frame, header, crash-recovery banner,
 * loading state, and the bank import dialog. The editor lifecycle (seeding,
 * autosave, save/close, Escape handling, focus helpers) lives in
 * `useQuizCanvasEditor`; the scrollable canvas body lives in
 * `QuizCanvasQuestionList`.
 */
export function QuizCanvasBuilder({ materialId, quizId, onClose, bottomInset = 0 }: QuizCanvasBuilderProps) {
    const {
        canvas,
        phase,
        recovery,
        errors,
        saveState,
        saveLabel,
        autosaveLabel,
        autosaveStatus,
        containerRef,
        titleCardRef,
        cardRefs,
        bankQuestions,
        bankImport,
        openBankImport,
        closeBankImport,
        handleSave,
        handleBack,
        handleRestore,
        handleDiscard,
        focusCard,
        focusCardIfOffScreen,
    } = useQuizCanvasEditor({ materialId, quizId, onClose });

    const { draft, activeCardId } = canvas;

    // Sticky-header height — the toolbar lane's `topInset`: the top edge of
    // the visible canvas area in viewport space (the pinned toolbar locks
    // below this header, never over it). Measured live via ResizeObserver so
    // breakpoint changes (the header collapses on ≤768px) propagate to the
    // lane's pin bound automatically.
    const headerRef = useRef<HTMLDivElement | null>(null);
    const [topInset, setTopInset] = useState(0);

    useEffect(() => {
        const headerWrap = headerRef.current;
        if (!headerWrap) return;
        const measure = () => setTopInset(headerWrap.offsetHeight);
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(headerWrap);
        return () => observer.disconnect();
    }, []);

    // Window-scroll mode: the document scrolls, so entering this route must
    // reset the window's scroll position (it persists across routes in a
    // SPA). The builder remounts per quizId (AppShell `key`), so this covers
    // quiz-to-quiz too.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div
            ref={containerRef}
            className="workspace-container"
            {...stylex.props(styles.workspace)}
            role="region"
            aria-label="Quiz builder"
        >
            <div ref={headerRef} {...stylex.props(styles.headerWrap)}>
                <QuizCanvasHeader
                    draftTitle={draft?.title.trim() || ''}
                    autosaveLabel={autosaveLabel}
                    autosaveStatus={autosaveStatus}
                    saveState={saveState}
                    saveLabel={saveLabel}
                    onBack={() => void handleBack()}
                    onSave={() => void handleSave()}
                />
            </div>

            {recovery && (
                <Banner
                    variant="warning"
                    title="Unsaved draft"
                    description={`Draft last edited ${formatDraftTime(recovery.updatedAt)}`}
                    container="section"
                    action={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button label="Restore draft" variant="secondary" onClick={handleRestore}>
                                Restore
                            </Button>
                            <Button label="Discard draft" variant="ghost" onClick={() => void handleDiscard()}>
                                Discard
                            </Button>
                        </div>
                    }
                />
            )}

            {phase === 'loading' || !draft ? (
                <div {...stylex.props(styles.loading)}>Loading quiz builder…</div>
            ) : (
                <QuizCanvasQuestionList
                    draft={draft}
                    activeCardId={activeCardId}
                    errors={errors}
                    titleCardRef={titleCardRef}
                    cardRefs={cardRefs}
                    canvas={canvas}
                    onFocusCard={focusCard}
                    onFocusCardIfOffScreen={focusCardIfOffScreen}
                    onImportFromBank={openBankImport}
                    bottomInset={bottomInset}
                    topInset={topInset}
                />
            )}

            <QuizCanvasBankImportDialog
                isOpen={bankImport.open}
                onClose={closeBankImport}
                questions={bankQuestions}
                usedQuestionIds={draft?.items.map((item) => item.questionId).filter((id): id is string => Boolean(id)) ?? []}
                onImport={(picked) => canvas.addBankItems(picked, bankImport.anchor ?? undefined)}
            />
        </div>
    );
}
