import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';

const REFLOW_DURATION = 0.35;

const styles = stylex.create({
    toolbarLane: {
        width: 56,
        flexShrink: 0,
        position: 'relative', // Shared coordinate space anchor
        height: '100%',
        '@media (max-width: 639px)': {
            width: 0,
        },
    },
    toolbarAbsoluteWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 'fit-content',
        willChange: 'transform',
        '@media (max-width: 639px)': {
            position: 'static',
            width: 'auto',
            willChange: 'auto',
        },
    },
});

export interface QuizCanvasToolbarLaneProps {
    items: QuestionDraft[];
    activeCardId: string | null;
    draggingId: string | null;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    gridRef?: RefObject<HTMLDivElement | null>;
    targetYMap?: Map<string, number>;
    layoutVersion?: number;
    canvasBodyRef?: RefObject<HTMLDivElement | null>;
    cardWrapperMapRef?: RefObject<Map<string, HTMLDivElement>>;
    canvas: QuizCanvas;
    onFocusCard: (tempId: string) => void;
    onImportFromBank: (index: number) => void;
}

/**
 * Decoupled right toolbar lane component (Direction-Aware Adaptive Settle Engine).
 *
 * Glides the active card toolbar using GSAP (`gsap.to`) anchored to active card DOM bounding rects.
 * - Direction-Aware Settle Engine:
 *   - Moving UP (Card N -> Card N-1): Target card is ABOVE old card. Its top edge position is ALREADY
 *     settled at t=0ms (since cards above it were already collapsed). Glides IMMEDIATELY (0ms delay).
 *   - Moving DOWN (Card N -> Card N+1): Target card is BELOW old card. The old card above must collapse
 *     (350ms duration) before target top edge settles. Waits 350ms for zero-rebound landing.
 * - Typing dilemma fix: ResizeObserver on the active card node provides live adjustments as text is typed.
 * - Drag freeze fix: Freezes the toolbar at its last Y coordinate while a card is being dragged,
 *   and glides to the active card's final slot on drag release (`requestAnimationFrame`).
 * - Meta Card fallback: Anchors beside titleCardRef when activeCardId is null.
 * - Mobile (<640px): Clears inline transforms so fixed viewport bottom bar operates cleanly.
 */
export function QuizCanvasToolbarLane({
    items,
    activeCardId,
    draggingId,
    titleCardRef,
    canvasBodyRef,
    cardWrapperMapRef,
    canvas,
    onFocusCard,
    onImportFromBank,
}: QuizCanvasToolbarLaneProps) {
    const toolbarWrapperRef = useRef<HTMLDivElement | null>(null);
    const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isDragging = draggingId !== null;
    const isDraggingRef = useRef(isDragging);
    isDraggingRef.current = isDragging;

    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
    );
    const isMobileRef = useRef(isMobile);
    isMobileRef.current = isMobile;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const query = window.matchMedia('(max-width: 639px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(query.matches);

        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
    }, []);

    const activeIndex = items.findIndex((item) => item.tempId === activeCardId);
    const isMetaCard = activeCardId === null || activeIndex === -1;
    const effectiveIndex = isMetaCard ? -1 : activeIndex;

    const prevIndexRef = useRef(effectiveIndex);

    const updatePosition = useCallback(
        (duration = REFLOW_DURATION) => {
            const wrapper = toolbarWrapperRef.current;
            if (!wrapper || isDraggingRef.current || isMobileRef.current) return;

            const canvasBodyNode = canvasBodyRef?.current;
            const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
            const targetNode = activeNode ?? titleCardRef?.current ?? null;

            if (!targetNode || !canvasBodyNode) return;

            const targetRect = targetNode.getBoundingClientRect();
            const bodyRect = canvasBodyNode.getBoundingClientRect();
            const nextY = Math.max(0, targetRect.top - bodyRect.top);

            gsap.to(wrapper, {
                y: nextY,
                duration,
                ease: 'power2.out',
                overwrite: 'auto',
            });
        },
        [activeCardId, canvasBodyRef, cardWrapperMapRef, titleCardRef],
    );

    // 1. Direction-Aware Adaptive Active Card Selection
    useEffect(() => {
        const oldIndex = prevIndexRef.current;
        const newIndex = effectiveIndex;
        prevIndexRef.current = effectiveIndex;

        const wrapper = toolbarWrapperRef.current;
        if (isMobile) {
            if (wrapper) {
                gsap.killTweensOf(wrapper, 'y');
                gsap.set(wrapper, { clearProps: 'transform,y' });
            }
            return;
        }

        if (isDragging) return;

        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        if (wrapper) gsap.killTweensOf(wrapper, 'y');

        // Directional Adaptive Delay:
        // Moving UP (newIndex < oldIndex): Target card is ABOVE old card -> top edge position is ALREADY settled at t=0! (0ms delay)
        // Moving DOWN (newIndex > oldIndex): Target card is BELOW old card -> old card above must collapse (350ms delay)
        const isMovingUp = newIndex >= 0 && oldIndex >= 0 && newIndex < oldIndex;
        const delay = isMovingUp ? 0 : 350;

        if (delay === 0) {
            updatePosition(REFLOW_DURATION);
        } else {
            settleTimerRef.current = setTimeout(() => {
                updatePosition(REFLOW_DURATION);
            }, delay);
        }

        return () => {
            if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        };
    }, [isMobile, effectiveIndex, isDragging, updatePosition]);

    // 2. Typing & Active Card Resizing Observation
    useEffect(() => {
        if (isMobile) return;

        const activeNode = activeCardId ? cardWrapperMapRef?.current?.get(activeCardId) : null;
        const targetNode = activeNode ?? titleCardRef?.current ?? null;
        if (!targetNode) return;

        const observer = new ResizeObserver(() => {
            if (isDraggingRef.current) return;
            // Live subtle adjustment while typing inside active card
            updatePosition(0.15);
        });

        observer.observe(targetNode);

        const handleResize = () => updatePosition(0.15);
        window.addEventListener('resize', handleResize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [isMobile, activeCardId, cardWrapperMapRef, titleCardRef, updatePosition]);

    // 3. Drag Release Handling: Freeze during drag, glide to slot on release
    useEffect(() => {
        if (!isDragging) {
            const rafId = requestAnimationFrame(() => {
                updatePosition(REFLOW_DURATION);
            });
            return () => cancelAnimationFrame(rafId);
        }
    }, [isDragging, updatePosition]);

    return (
        <div {...stylex.props(styles.toolbarLane)}>
            <div
                ref={toolbarWrapperRef}
                {...stylex.props(styles.toolbarAbsoluteWrapper)}
            >
                <QuizCanvasCardToolbar
                    index={effectiveIndex}
                    totalItems={items.length}
                    onAddBelow={() => onFocusCard(canvas.addItemAt(isMetaCard ? 0 : effectiveIndex))}
                    onDuplicate={() => {
                        if (activeCardId) canvas.duplicateItem(activeCardId);
                    }}
                    onMoveUp={() => {
                        if (!isMetaCard) canvas.reorderItems(effectiveIndex, effectiveIndex - 1);
                    }}
                    onMoveDown={() => {
                        if (!isMetaCard) canvas.reorderItems(effectiveIndex, effectiveIndex + 1);
                    }}
                    onImportFromBank={() => onImportFromBank(isMetaCard ? 0 : effectiveIndex)}
                    onDelete={() => {
                        if (activeCardId) canvas.deleteItem(activeCardId);
                    }}
                />
            </div>
        </div>
    );
}
