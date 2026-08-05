import * as stylex from '@stylexjs/stylex';
import { Banner } from '../../../shared/ui/Banner/Banner';
import { Button } from '../../../shared/ui/Button/Button';
import { useQuizCanvasEditor } from '../hooks/useQuizCanvasEditor';
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
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--color-background-surface)',
        overflow: 'hidden',
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
export function QuizCanvasBuilder({ materialId, quizId, onClose }: QuizCanvasBuilderProps) {
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
    } = useQuizCanvasEditor({ materialId, quizId, onClose });

    const { draft, activeCardId } = canvas;

    return (
        <div
            ref={containerRef}
            className="workspace-container"
            {...stylex.props(styles.workspace)}
            role="region"
            aria-label="Quiz builder"
        >
            <QuizCanvasHeader
                draftTitle={draft?.title.trim() || ''}
                autosaveLabel={autosaveLabel}
                autosaveStatus={autosaveStatus}
                saveState={saveState}
                saveLabel={saveLabel}
                onBack={() => void handleBack()}
                onSave={() => void handleSave()}
            />

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
                    onImportFromBank={openBankImport}
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
