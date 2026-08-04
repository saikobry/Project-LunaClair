import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useToast } from '../../../app/providers/ToastContext';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import { createEmptyQuizDraft, createQuizDraftFromQuiz } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import { Button } from '../../../shared/ui/Button/Button';
import { useDraftAutosave } from '../../../shared/hooks/useDraftAutosave';
import { useDragReorder } from '../../../shared/hooks/useDragReorder';
import { useQuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasBankImportDialog } from './QuizCanvasBankImportDialog';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';
import { QuizCanvasHeader } from './QuizCanvasHeader';
import { QuizCanvasMetaCard } from './QuizCanvasMetaCard';
import { QuizCanvasQuestionCard } from './QuizCanvasQuestionCard';

type SaveButtonState = 'idle' | 'saving' | 'saved';

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
    backdrop: {
        backgroundColor: 'var(--color-background-muted)',
    },
    recoveryBanner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 20px',
        backgroundColor: 'var(--color-warning-muted)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
    },
    recoveryText: {
        fontSize: 13,
        fontWeight: 500,
        color: '#854d0e',
        margin: 0,
    },
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
    canvas: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 96px',
    },
    canvasColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        width: '100%',
        maxWidth: 760,
    },
    cardWrapper: {
        position: 'relative',
    },
    cardWrapperActive: {
        zIndex: 2,
    },
    addQuestionButton: {
        display: 'flex',
        justifyContent: 'center',
        padding: '14px 16px',
        border: '1px dashed var(--color-border)',
        borderRadius: 10,
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
    },
    emptyCanvas: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '40px 24px',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    emptyHint: {
        fontSize: 13,
        margin: 0,
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
 * Editor lifecycle owner: seeds the canvas from the catalog (or an empty
 * draft), runs the 3-layer save model (canvas state → autosaved Dexie
 * draft → `SaveQuizUseCase` atomic commit), prompts draft recovery, and
 * after a successful save deletes the local draft and invalidates
 * TanStack Query caches.
 */
export function QuizCanvasBuilder({ materialId, quizId, onClose }: QuizCanvasBuilderProps) {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizCanvasBuilder must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const canvas = useQuizCanvas();
    const { draft, activeCardId } = canvas;

    const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
    const [recovery, setRecovery] = useState<QuizDraft | null>(null);
    const [errors, setErrors] = useState<QuizDraftErrors | null>(null);
    const [saveState, setSaveState] = useState<SaveButtonState>('idle');
    const [bankImport, setBankImport] = useState<{ open: boolean; anchor: number | null }>({ open: false, anchor: null });

    const dialogRef = useRef<HTMLDialogElement>(null);
    const cardRefs = useRef(new Map<string, HTMLElement>());
    const titleCardRef = useRef<HTMLDivElement>(null);
    const savedTimerRef = useRef<number | null>(null);

    const { data: bankQuestions = [] } = useQuery({
        queryKey: ['assessment', 'questions', materialId],
        queryFn: ({ signal }) => context.questionRepository.getQuestions(materialId, signal),
    });

    // ── Seed the canvas and detect a recoverable draft ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            let recoverable: QuizDraft | null = null;
            if (quizId) {
                recoverable = await context.quizDraftRepository.getDraftForQuiz(quizId);
            } else {
                const latest = await context.quizDraftRepository.getDraftForMaterial(materialId);
                recoverable = latest && !latest.quizId ? latest : null;
            }

            let seed: QuizDraft;
            if (quizId) {
                const quiz = await context.quizRepository.getQuizById(quizId);
                if (quiz) {
                    const questions = await context.questionRepository.getQuestionsByIds(quiz.questionIds);
                    seed = createQuizDraftFromQuiz(quiz, questions);
                } else {
                    seed = createEmptyQuizDraft(materialId, quizId);
                }
            } else {
                seed = createEmptyQuizDraft(materialId);
            }

            if (cancelled) return;
            canvas.setDraft(seed);
            if (seed.items.length === 0) canvas.addItemAt();
            setRecovery(recoverable);
            setPhase('ready');
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- stable singletons (context, canvas callbacks)
    }, [materialId, quizId]);

    // ── Layer 2: draft autosave (2s debounce / blur / unload / 30s throttle) ──
    const persistDraft = useCallback(
        (candidate: QuizDraft) => {
            if (!candidate.isDirty) return Promise.resolve();
            return context.quizDraftRepository.saveDraft(candidate);
        },
        [context],
    );

    const autosaveEnabled = phase === 'ready' && recovery === null;
    const { status: autosaveStatus, flush } = useDraftAutosave<QuizDraft>({
        draft,
        enabled: autosaveEnabled,
        persist: persistDraft,
    });

    // Validation errors clear as soon as the author keeps editing.
    useEffect(() => {
        setErrors((prev) => (prev ? null : prev));
    }, [draft]);

    useEffect(() => () => {
        if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current);
    }, []);

    // Open as native modal dialog on mount.
    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    const focusCard = useCallback((tempId: string) => {
        requestAnimationFrame(() => {
            cardRefs.current.get(tempId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, []);

    const focusFirstInvalid = useCallback((draftErrors: QuizDraftErrors) => {
        if (draftErrors.title) {
            titleCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            titleCardRef.current?.querySelector('input')?.focus({ preventScroll: true });
            return;
        }
        if (!draft) return;
        for (const item of draft.items) {
            if (draftErrors.items[item.tempId]?.length) {
                canvas.setActiveCardId(item.tempId);
                focusCard(item.tempId);
                return;
            }
        }
    }, [draft, canvas, focusCard]);

    // ── Layer 3: explicit save via SaveQuizUseCase ──
    const handleSave = useCallback(async () => {
        if (!draft || saveState === 'saving') return;
        setSaveState('saving');
        try {
            const result = await context.useCases.quizManagement.saveQuiz.execute(draft);
            if (!result.success) {
                setErrors(result.errors);
                setSaveState('idle');
                focusFirstInvalid(result.errors);
                return;
            }
            // UI editor lifecycle: drop the crash-recovery draft, refresh caches.
            await context.quizDraftRepository.deleteDraft(draft.draftId);
            void queryClient.invalidateQueries({ queryKey: ['assessment'] });
            showToast('Quiz saved to catalog', { intent: 'success' });
            canvas.commitSaved(result.quizId);
            setSaveState('saved');
            if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current);
            savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 2500);
        } catch {
            showToast('Save failed — your draft is preserved locally', { intent: 'error' });
            setSaveState('idle');
        }
    }, [draft, saveState, context, queryClient, showToast, canvas, focusFirstInvalid]);

    const handleBack = useCallback(async () => {
        await flush();
        onClose();
    }, [flush, onClose]);

    // Intercept native Escape-to-close to route through the autosave-flushing close handler.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const onCancel = (event: Event) => {
            event.preventDefault();
            void handleBack();
        };
        dialog.addEventListener('cancel', onCancel);
        return () => dialog.removeEventListener('cancel', onCancel);
    }, [handleBack]);

    const handleRestore = useCallback(() => {
        if (!recovery) return;
        canvas.setDraft(recovery);
        setRecovery(null);
        showToast('Draft restored', { intent: 'info' });
    }, [recovery, canvas, showToast]);

    const handleDiscard = useCallback(async () => {
        if (!recovery) return;
        await context.quizDraftRepository.deleteDraft(recovery.draftId);
        setRecovery(null);
    }, [recovery, context]);

    const { state: dragState, getHandleProps, getItemProps } = useDragReorder({
        itemCount: draft?.items.length ?? 0,
        onReorder: canvas.reorderItems,
    });

    const autosaveLabel =
        autosaveStatus === 'saved' ? 'Draft Saved ✓'
            : autosaveStatus === 'saving' ? 'Saving draft…'
                : autosaveStatus === 'pending' ? 'Unsaved changes'
                    : '';

    const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save Quiz';

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
                <div {...stylex.props(styles.recoveryBanner)} role="alert">
                    <p {...stylex.props(styles.recoveryText)}>
                        Unsaved draft from {formatDraftTime(recovery.updatedAt)}
                    </p>
                    <Button label="Restore draft" variant="secondary" onClick={handleRestore}>
                        Restore
                    </Button>
                    <Button label="Discard draft" variant="ghost" onClick={() => void handleDiscard()}>
                        Discard
                    </Button>
                </div>
            )}

            {phase === 'loading' || !draft ? (
                <div {...stylex.props(styles.loading)}>Loading quiz builder…</div>
            ) : (
                <div {...stylex.props(styles.canvas)}>
                    <div {...stylex.props(styles.canvasColumn)}>
                        <QuizCanvasMetaCard
                            ref={titleCardRef}
                            title={draft.title}
                            description={draft.description ?? ''}
                            passingPercentage={draft.passingPercentage}
                            titleError={errors?.title}
                            onChange={(patch) => canvas.patchDraft(patch)}
                        />

                        {draft.items.length === 0 && (
                            <div {...stylex.props(styles.emptyCanvas)}>
                                <p {...stylex.props(styles.emptyTitle)}>No questions yet</p>
                                <p {...stylex.props(styles.emptyHint)}>
                                    Add a question below or import existing questions from the Question Bank.
                                </p>
                            </div>
                        )}

                        {draft.items.map((item, index) => {
                            const isActive = activeCardId === item.tempId;
                            return (
                                <div
                                    key={item.tempId}
                                    {...stylex.props(styles.cardWrapper, isActive && styles.cardWrapperActive)}
                                >
                                    <QuizCanvasQuestionCard
                                        item={item}
                                        index={index}
                                        isActive={isActive}
                                        isDragOver={dragState.overIndex === index && dragState.dragIndex !== index}
                                        isDragging={dragState.dragIndex === index}
                                        errors={errors?.items[item.tempId] ?? []}
                                        cardRef={(el) => {
                                            if (el) cardRefs.current.set(item.tempId, el);
                                            else cardRefs.current.delete(item.tempId);
                                        }}
                                        handleProps={getHandleProps(index)}
                                        itemProps={getItemProps(index)}
                                        onActivate={() => canvas.setActiveCardId(item.tempId)}
                                        onChange={(patch) => canvas.updateItem(item.tempId, patch)}
                                        onTypeChange={(type) => canvas.changeItemType(item.tempId, type)}
                                    />
                                    {isActive && (
                                        <QuizCanvasCardToolbar
                                            index={index}
                                            totalItems={draft.items.length}
                                            onAddBelow={() => focusCard(canvas.addItemAt(index))}
                                            onDuplicate={() => canvas.duplicateItem(item.tempId)}
                                            onMoveUp={() => canvas.reorderItems(index, index - 1)}
                                            onMoveDown={() => canvas.reorderItems(index, index + 1)}
                                            onImportFromBank={() => setBankImport({ open: true, anchor: index })}
                                            onDelete={() => canvas.deleteItem(item.tempId)}
                                        />
                                    )}
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            {...stylex.props(styles.addQuestionButton)}
                            onClick={() => focusCard(canvas.addItemAt())}
                        >
                            + Add Question
                        </button>
                    </div>
                </div>
            )}

            <QuizCanvasBankImportDialog
                isOpen={bankImport.open}
                onClose={() => setBankImport({ open: false, anchor: null })}
                questions={bankQuestions}
                usedQuestionIds={draft?.items.map((item) => item.questionId).filter((id): id is string => Boolean(id)) ?? []}
                onImport={(picked) => canvas.addBankItems(picked, bankImport.anchor ?? undefined)}
            />
        </dialog>
    );
}
