import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useToast } from '../../../app/providers/ToastContext';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import { createEmptyQuizDraft, createQuizDraftFromQuiz } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import type { Question } from '../../../domain/quiz/Question';
import { useDraftAutosave, type DraftAutosaveStatus } from '../../../shared/hooks/useDraftAutosave';
import { useQuizCanvas, type QuizCanvas } from './useQuizCanvas';

export type QuizCanvasSaveState = 'idle' | 'saving' | 'saved';

export interface QuizCanvasEditorOptions {
    materialId: string;
    /** Present when editing an existing catalog quiz. */
    quizId?: string;
    onClose: () => void;
}

export interface QuizCanvasEditorResult {
    /** Canvas state + draft mutation API (used by the builder shell and the question list). */
    canvas: QuizCanvas;
    phase: 'loading' | 'ready';
    /** Crash-recovery draft awaiting the author's restore/discard decision. */
    recovery: QuizDraft | null;
    /** Save validation errors keyed by title / item tempId. */
    errors: QuizDraftErrors | null;
    saveState: QuizCanvasSaveState;
    saveLabel: string;
    autosaveLabel: string;
    autosaveStatus: DraftAutosaveStatus;
    /** Root element of the embedded workspace (non-modal). */
    containerRef: RefObject<HTMLDivElement | null>;
    titleCardRef: RefObject<HTMLDivElement | null>;
    cardRefs: RefObject<Map<string, HTMLElement>>;
    bankQuestions: Question[];
    bankImport: { open: boolean; anchor: number | null };
    openBankImport: (index: number) => void;
    closeBankImport: () => void;
    handleSave: () => Promise<void>;
    handleBack: () => Promise<void>;
    handleRestore: () => void;
    handleDiscard: () => Promise<void>;
    focusCard: (tempId: string) => void;
}

/**
 * Quiz canvas editor lifecycle hook.
 *
 * Owns everything the builder needs beyond pure presentation: the canvas
 * session (`useQuizCanvas`), catalog seeding + crash-draft recovery, the
 * 3-layer save model (canvas state → `useDraftAutosave` Dexie draft →
 * `SaveQuizUseCase` atomic commit), focus/scrolling helpers, and the bank
 * import picker state. Returns a flat result the shell and its child
 * components consume.
 */
export function useQuizCanvasEditor({ materialId, quizId, onClose }: QuizCanvasEditorOptions): QuizCanvasEditorResult {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('QuizCanvasBuilder must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const canvas = useQuizCanvas();
    const { draft } = canvas;

    const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
    const [recovery, setRecovery] = useState<QuizDraft | null>(null);
    const [errors, setErrors] = useState<QuizDraftErrors | null>(null);
    const [saveState, setSaveState] = useState<QuizCanvasSaveState>('idle');
    const [bankImport, setBankImport] = useState<{ open: boolean; anchor: number | null }>({ open: false, anchor: null });

    const containerRef = useRef<HTMLDivElement>(null);
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

    // Embedded workspace (no native dialog): route Escape through the
    // autosave-flushing close handler. The bank import picker is its own
    // modal — it owns Escape while open.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || bankImport.open || event.defaultPrevented) return;
            event.preventDefault();
            void handleBack();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleBack, bankImport.open]);

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

    const openBankImport = useCallback((index: number) => {
        setBankImport({ open: true, anchor: index });
    }, []);

    const closeBankImport = useCallback(() => {
        setBankImport({ open: false, anchor: null });
    }, []);

    const autosaveLabel =
        autosaveStatus === 'saved' ? 'Draft Saved ✓'
            : autosaveStatus === 'saving' ? 'Saving draft…'
                : autosaveStatus === 'pending' ? 'Unsaved changes'
                    : '';

    const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save Quiz';

    return {
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
    };
}
