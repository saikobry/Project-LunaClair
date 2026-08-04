import * as stylex from '@stylexjs/stylex';
import { GripVertical, Link2 } from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import { Input } from '../../../shared/ui/Input';
import { Selector } from '../../../shared/ui/Selector/Selector';
import { getQuestionEditor, QUESTION_TYPE_OPTIONS } from '../editors/QuestionEditorRegistry';

const styles = stylex.create({
    card: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    },
    cardActive: {
        borderColor: 'var(--color-accent)',
        boxShadow: 'var(--shadow-med)',
        cursor: 'default',
    },
    cardDragOver: {
        borderTop: '2px dashed var(--color-accent)',
    },
    cardDragging: {
        opacity: 0.5,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    grip: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-disabled)',
        cursor: 'grab',
        padding: 4,
        borderRadius: 4,
        flexShrink: 0,
    },
    index: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        flexShrink: 0,
    },
    bankTag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-accent)',
        backgroundColor: 'var(--color-accent-muted)',
        padding: '2px 8px',
        borderRadius: 5,
        flexShrink: 0,
    },
    typeSelector: {
        flex: 1,
        minWidth: 0,
    },
    pointsInput: {
        width: 72,
        flexShrink: 0,
        padding: '6px 8px',
        fontSize: 13,
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-background)',
    },
    pointsLabel: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        flexShrink: 0,
    },
    collapsedPrompt: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    collapsedPromptEmpty: {
        color: 'var(--color-text-disabled)',
        fontStyle: 'italic',
    },
    body: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    errorCallout: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 12px',
        borderRadius: 6,
        backgroundColor: 'var(--color-error-muted)',
        border: '1px solid var(--color-error)',
        margin: 0,
    },
    errorText: {
        fontSize: 12,
        color: 'var(--color-error)',
        margin: 0,
    },
});

interface QuizCanvasQuestionCardProps {
    item: QuestionDraft;
    index: number;
    isActive: boolean;
    isDragOver: boolean;
    isDragging: boolean;
    errors: string[];
    cardRef: (el: HTMLElement | null) => void;
    handleProps: {
        draggable: boolean;
        onDragStart: (event: DragEvent) => void;
        onDragEnd: () => void;
    };
    itemProps: {
        onDragOver: (event: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: (event: DragEvent) => void;
    };
    onActivate: () => void;
    onChange: (patch: Partial<QuestionDraft>) => void;
    onTypeChange: (type: QuestionType) => void;
}

/**
 * A single question card on the quiz canvas.
 *
 * Collapsed (inactive) cards show only the prompt summary; the active
 * card expands into full editing with the type-specific editor. Bank-
 * linked cards are tagged and lock their type (the Question Bank owns
 * the question's type).
 */
export function QuizCanvasQuestionCard({
    item,
    index,
    isActive,
    isDragOver,
    isDragging,
    errors,
    cardRef,
    handleProps,
    itemProps,
    onActivate,
    onChange,
    onTypeChange,
}: QuizCanvasQuestionCardProps) {
    const EditorComponent = getQuestionEditor(item.type);

    const headerRow: ReactNode = (
        <div {...stylex.props(styles.header)}>
            <span
                {...handleProps}
                {...stylex.props(styles.grip)}
                aria-label={`Drag to reorder question ${index + 1}`}
                onClick={(event) => event.stopPropagation()}
            >
                <GripVertical size={16} />
            </span>
            <span {...stylex.props(styles.index)}>Q{index + 1}</span>
            {item.questionId && (
                <span {...stylex.props(styles.bankTag)}>
                    <Link2 size={11} />
                    Bank
                </span>
            )}
            {isActive ? (
                <>
                    <div {...stylex.props(styles.typeSelector)}>
                        <Selector
                            label={`Question ${index + 1} type`}
                            isLabelHidden
                            options={QUESTION_TYPE_OPTIONS}
                            value={item.type}
                            onChange={(value) => onTypeChange(value as QuestionType)}
                            disabled={Boolean(item.questionId)}
                            size="sm"
                        />
                    </div>
                    <span {...stylex.props(styles.pointsLabel)}>Points</span>
                    <input
                        type="number"
                        min={1}
                        value={item.points}
                        onChange={(event) => {
                            const value = event.target.valueAsNumber;
                            onChange({ points: Number.isFinite(value) ? value : 0 });
                        }}
                        onClick={(event) => event.stopPropagation()}
                        {...stylex.props(styles.pointsInput)}
                        aria-label={`Points for question ${index + 1}`}
                    />
                </>
            ) : (
                <p
                    {...stylex.props(
                        styles.collapsedPrompt,
                        !item.prompt.trim() && styles.collapsedPromptEmpty,
                    )}
                >
                    {item.prompt.trim() || 'Untitled question'}
                </p>
            )}
        </div>
    );

    return (
        <div
            ref={cardRef}
            {...itemProps}
            {...stylex.props(
                styles.card,
                isActive && styles.cardActive,
                isDragOver && styles.cardDragOver,
                isDragging && styles.cardDragging,
            )}
            onClick={onActivate}
            role="group"
            aria-label={`Question ${index + 1}`}
        >
            {headerRow}

            {isActive ? (
                <div {...stylex.props(styles.body)} onClick={(event) => event.stopPropagation()}>
                    <Input
                        label={`Question ${index + 1} prompt`}
                        labelHidden
                        value={item.prompt}
                        onChange={(value) => onChange({ prompt: value })}
                        placeholder="Type the question prompt…"
                        required
                    />
                    <EditorComponent
                        value={item.payload as never}
                        onChange={(payload: never) => onChange({ payload })}
                    />
                </div>
            ) : null}

            {errors.length > 0 && (
                <div {...stylex.props(styles.errorCallout)} onClick={(event) => event.stopPropagation()}>
                    {errors.map((error) => (
                        <p key={error} {...stylex.props(styles.errorText)}>{error}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
