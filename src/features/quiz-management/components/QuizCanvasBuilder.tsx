import * as stylex from '@stylexjs/stylex';
import { Banner } from '../../../shared/ui/Banner/Banner';
import { Button } from '../../../shared/ui/Button/Button';
import { useQuizCanvasEditor } from '../hooks/useQuizCanvasEditor';
import { QuizCanvasBankImportDialog } from './QuizCanvasBankImportDialog';
import { QuizCanvasHeader } from './QuizCanvasHeader';
import { QuizCanvasQuestionList } from './QuizCanvasQuestionList';

const styles = stylex.create({
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        border: 'none',
        padding: 0,
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
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
 * Full-screen Google Forms-style quiz authoring workspace.
 *
 * Thin shell: owns the modal frame, header, crash-recovery banner, loading
 * state, and the bank import dialog. The editor lifecycle (seeding, autosave,
 * save/close, focus helpers) lives in `useQuizCanvasEditor`; the scrollable
 * canvas body lives in `QuizCanvasQuestionList`.
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
        dialogRef,
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
        <dialog ref={dialogRef} {...stylex.props(styles.overlay)} aria-label="Quiz builder">
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
        </dialog>
    );
}
