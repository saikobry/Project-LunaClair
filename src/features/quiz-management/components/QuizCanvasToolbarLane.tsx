import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';

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
        transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
        '@media (max-width: 639px)': {
            position: 'static',
            width: 'auto',
            transition: 'none',
            willChange: 'auto',
        },
    },
});

export interface QuizCanvasToolbarLaneProps {
    items: QuestionDraft[];
    activeCardId: string | null;
    draggingId: string | null;
    titleCardRef?: RefObject<HTMLDivElement | null>;
    canvasBodyRef: RefObject<HTMLDivElement | null>;
    /** Map of card wrapper DOM elements keyed by tempId */
    cardWrapperMapRef: RefObject<Map<string, HTMLDivElement>>;
    canvas: QuizCanvas;
    onFocusCard: (tempId: string) => void;
    onImportFromBank: (index: number) => void;
}

/**
 * Decoupled right toolbar lane component (Google Forms Continuous Observation Pattern).
 *
 * Owns the positioning wrapper (`position: absolute; top: 0`) and uses a `ResizeObserver`
 * combined with physical `getBoundingClientRect` DOM measurement to track the active card's
 * exact Y-offset relative to the shared `canvasBody` anchor. When no question card is selected,
 * it defaults to anchoring beside the Meta Card (`titleCardRef`).
 * Glides smoothly via native CSS `transform: translateY(...)` (`cubic-bezier(0.2, 0, 0, 1)`).
 * Dynamically clears `transform` on mobile (<640px) so `position: fixed` child toolbar stays
 * anchored to the viewport bottom without containing block interference.
 * Preserves wrapper DOM node across drag cycles with opacity/pointer-events to prevent teleporting.
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
    const [toolbarY, setToolbarY] = useState(0);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const query = window.matchMedia('(max-width: 639px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        setIsMobile(query.matches);

        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
    }, []);

    const activeIndex = items.findIndex((item) => item.tempId === activeCardId);
    const activeCardNode = activeCardId ? cardWrapperMapRef.current?.get(activeCardId) : null;
    const targetNode = activeCardNode ?? titleCardRef?.current ?? null;

    const updatePosition = useCallback(() => {
        if (isMobile) return;
        const canvasBodyNode = canvasBodyRef.current;
        if (!targetNode || !canvasBodyNode) return;

        const targetRect = targetNode.getBoundingClientRect();
        const bodyRect = canvasBodyNode.getBoundingClientRect();
        const calculatedY = Math.max(0, targetRect.top - bodyRect.top);

        setToolbarY(calculatedY);
    }, [isMobile, targetNode, canvasBodyRef]);

    useEffect(() => {
        if (isMobile || !targetNode) return;

        updatePosition();

        const canvasBodyNode = canvasBodyRef.current;
        if (!canvasBodyNode) return;

        const observer = new ResizeObserver(() => {
            updatePosition();
        });

        observer.observe(canvasBodyNode);
        observer.observe(targetNode);

        window.addEventListener('resize', updatePosition);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updatePosition);
        };
    }, [isMobile, targetNode, canvasBodyRef, updatePosition]);

    const isMetaCard = activeCardId === null || activeIndex === -1;
    const effectiveIndex = isMetaCard ? -1 : activeIndex;

    return (
        <div {...stylex.props(styles.toolbarLane)}>
            <div
                {...stylex.props(styles.toolbarAbsoluteWrapper)}
                style={{
                    transform: isMobile ? undefined : `translateY(${toolbarY}px)`,
                    opacity: draggingId !== null ? 0 : 1,
                    pointerEvents: draggingId !== null ? 'none' : 'auto',
                }}
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
