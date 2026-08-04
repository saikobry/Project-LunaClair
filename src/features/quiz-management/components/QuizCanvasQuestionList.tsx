import * as stylex from '@stylexjs/stylex';
import type { RefObject } from 'react';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuizDraftErrors } from '../../../application/quiz-management/drafts/quizDraftValidation';
import { Button } from '../../../shared/ui/Button/Button';
import { useDragReorder } from '../../../shared/hooks/useDragReorder';
import type { QuizCanvas } from '../hooks/useQuizCanvas';
import { QuizCanvasCardToolbar } from './QuizCanvasCardToolbar';
import { QuizCanvasMetaCard } from './QuizCanvasMetaCard';
import { QuizCanvasQuestionCard } from './QuizCanvasQuestionCard';

const styles = stylex.create({
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

interface QuizCanvasQuestionListProps {
    draft: QuizDraft;
    activeCardId: string | null;
    errors: QuizDraftErrors | null;
    titleCardRef: RefObject<HTMLDivElement | null>;
    /** Live registry of question card elements keyed by tempId (scroll-to on focus). */
    cardRefs: RefObject<Map<string, HTMLElement>>;
    canvas: QuizCanvas;
    /** Scrolls a card into view after structural mutations (add/duplicate). */
    onFocusCard: (tempId: string) => void;
    /** Opens the bank import picker anchored after the given card index. */
    onImportFromBank: (index: number) => void;
}

/**
 * Scrollable canvas body of the quiz builder.
 *
 * Renders the meta card, the question cards (active card gets the floating
 * toolbar), the empty state, and the add-question button. Owns drag-and-drop
 * reorder presentation via `useDragReorder`; all draft mutations are
 * delegated through the `canvas` API.
 */
export function QuizCanvasQuestionList({
    draft,
    activeCardId,
    errors,
    titleCardRef,
    cardRefs,
    canvas,
    onFocusCard,
    onImportFromBank,
}: QuizCanvasQuestionListProps) {
    const { state: dragState, getHandleProps, getItemProps } = useDragReorder({
        itemCount: draft.items.length,
        onReorder: canvas.reorderItems,
    });

    return (
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

                {draft.items.length === 0 ? (
                    <div {...stylex.props(styles.emptyCanvas)}>
                        <p {...stylex.props(styles.emptyTitle)}>No questions yet</p>
                        <p {...stylex.props(styles.emptyHint)}>
                            Add your first question to start building this quiz.
                        </p>
                        <Button
                            label="Add first question"
                            variant="primary"
                            onClick={() => onFocusCard(canvas.addItemAt())}
                        >
                            + Add First Question
                        </Button>
                    </div>
                ) : (
                    draft.items.map((item, index) => {
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
                                        onAddBelow={() => onFocusCard(canvas.addItemAt(index))}
                                        onDuplicate={() => canvas.duplicateItem(item.tempId)}
                                        onMoveUp={() => canvas.reorderItems(index, index - 1)}
                                        onMoveDown={() => canvas.reorderItems(index, index + 1)}
                                        onImportFromBank={() => onImportFromBank(index)}
                                        onDelete={() => canvas.deleteItem(item.tempId)}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
