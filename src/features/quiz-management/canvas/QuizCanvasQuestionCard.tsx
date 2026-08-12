import { useState, type ReactNode, type RefObject } from 'react';
import * as stylex from '@stylexjs/stylex';
import { GripVertical, Link2 } from 'lucide-react';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import { DIFFICULTY_APPEARANCE, POINTS_APPEARANCE, QUESTION_TYPE_APPEARANCE } from '../../../domain/quiz/quizBadgeAppearance';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import { NumberInput } from '../../../shared/ui/NumberInput/NumberInput';
import { Selector } from '../../../shared/ui/Selector/Selector';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { getQuestionEditor, QUESTION_TYPE_OPTIONS } from '../editors/QuestionEditorRegistry';
import { QuizCanvasAnswerMetadataDrawer } from './QuizCanvasAnswerMetadataDrawer';

/** Answers shown in the collapsed answer chip before the "+N more" suffix. */
const MAX_VISIBLE_ANSWERS = 3;

/**
 * Joins the correct answers for the collapsed chip. Multi-answer questions
 * (multiple-select) render as ONE chip — `✓ A + B + C` — keeping the
 * single-select "one chip = one verdict" grammar, with `+` reading as "all
 * of these" (AND) rather than alternatives. Long sets truncate with a
 * "+N more" suffix; the full list stays available on hover (title tooltip)
 * and by opening the card.
 */
function formatAnswerList(answers: string[]): string {
    if (answers.length <= 1) return answers[0] ?? '';
    const visible = answers.slice(0, MAX_VISIBLE_ANSWERS);
    const joined = visible.join(' + ');
    const hidden = answers.length - visible.length;
    return hidden > 0 ? `${joined} +${hidden} more` : joined;
}

/**
 * The correct-answer strings for a payload, in display order. Multiple-select
 * returns ONE ENTRY PER correct choice (joined into a single "✓ A + B + C"
 * chip in the collapsed card); every other type returns a single entry
 * (fill-in-blank joins its blanks into one string). Returns null when there
 * is no answer to show.
 */
function getCorrectAnswerList(payload: QuestionDraft['payload']): string[] | null {
    switch (payload.type) {
        case 'multiple_choice': {
            const text = payload.choices[payload.correctIndex]?.trim();
            return text ? [text] : null;
        }
        case 'multiple_select': {
            const selected = payload.correctIndices.flatMap((i) => {
                const text = payload.choices[i]?.trim();
                return text ? [text] : [];
            });
            return selected.length > 0 ? selected : null;
        }
        case 'true_false':
            return [payload.correctAnswer === true ? 'True' : 'False'];
        case 'identification':
            return payload.correctAnswer.trim() ? [payload.correctAnswer.trim()] : null;
        case 'fill_in_blank': {
            const nonBlank = payload.blanks.flatMap((b) => {
                const text = b.trim();
                return text ? [text] : [];
            });
            return nonBlank.length > 0 ? [nonBlank.join(', ')] : null;
        }
        default:
            return null;
    }
}

const styles = stylex.create({
    card: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        backgroundColor: 'var(--color-background-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, border-width 0.15s ease',
        ':hover': {
            borderColor: 'var(--color-accent)',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.12)',
        },
    },
    cardActive: {
        borderWidth: 2,
        borderColor: 'var(--color-accent)',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)',
        cursor: 'default',
        ':hover': {
            borderColor: 'var(--color-accent)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)',
        },
    },
    cardDragging: {
        borderWidth: 2,
        borderColor: 'var(--color-accent)',
        boxShadow: '0 14px 32px rgba(99, 102, 241, 0.25)',
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
        // Two-line clamp — the prompt owns a full row in the collapsed
        // two-row layout, so it can wrap to 2 lines instead of being
        // squeezed to nothing by the badge row on narrow cards.
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        flex: 1,
        minWidth: 0,
    },
    collapsedPromptEmpty: {
        // Clean muted placeholder — never the gray-italic "Untitled question"
        // fallback, so a held card always reads as a live, typed prompt.
        color: 'var(--color-text-secondary)',
    },
    collapsedMeta: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    // Structural chip base only — every badge's colors come from the domain
    // appearance records (POINTS_APPEARANCE / DIFFICULTY_APPEARANCE /
    // QUESTION_TYPE_APPEARANCE), so the palette has one owner.
    metaChip: {
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 5,
    },
    answerChip: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-success)',
        backgroundColor: 'var(--color-success-muted)',
        padding: '2px 8px',
        borderRadius: 5,
        // No max width — the chip sizes to its content; if the group can't fit
        // beside the other chips it wraps onto its own right-aligned line
        // (and, on a very narrow card, ellipsizes rather than wrapping text).
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    // Right-aligned answer group — its auto margin absorbs the badge row's
    // free space so the ✓ answer chip (single or +-joined multiple-select)
    // hugs the right edge. Auto margins on the chips themselves instead
    // would split the free space between them and scatter them across the row.
    answerGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 'auto',
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
    /** True while this card is held by a drag — active cards render as a clean collapsed summary. */
    isDragging?: boolean;
    errors: string[];
    cardRef: (el: HTMLElement | null) => void;
    onActivate: () => void;
    onChange: (patch: Partial<QuestionDraft>) => void;
    onTypeChange: (type: QuestionType) => void;
    /**
     * Shared set of tempIds with an in-flight GSAP height tween (owned by
     * `QuizCanvasQuestionList`). While the metadata drawer animates, the card
     * registers its tempId so the list's wrapper ResizeObserver takes the cheap
     * frame-synced instant-push branch instead of settling (and re-rendering)
     * the whole canvas every frame. Optional so the card stays self-sufficient.
     */
    heightAnimRef?: RefObject<Set<string>>;
}

/**
 * A single question card on the quiz canvas.
 *
 * Collapsed (inactive) cards show a two-row summary — the prompt (2-line
 * clamp) with the points/difficulty/type chips on a row beneath it and the
 * ✓ answer chip right-aligned at the end (multiple-select joins its answers
 * as ✓ A + B + C, truncated with "+N more"); the active card expands into
 * full editing with the type-specific editor. Bank-
 * linked cards are tagged and lock their type (the Question Bank owns
 * the question's type). While dragged (`isDragging`), an active card
 * renders as a clean collapsed summary (`effectiveIsActive`) instead of
 * a clipped editor. Visual states: the active card gets a prominent 2px
 * accent border + indigo glow (`cardActive`); the held card keeps the 2px
 * accent border with an elevated floating shadow (`cardDragging`). Shadows
 * are CSS-owned — GSAP never tweens `box-shadow` on this card. The grip is
 * the drag trigger for the GSAP `Draggable` instance owned by
 * `QuizCanvasQuestionList`.
 */
export function QuizCanvasQuestionCard({
    item,
    index,
    isActive,
    isDragging = false,
    errors,
    cardRef,
    onActivate,
    onChange,
    onTypeChange,
    heightAnimRef,
}: QuizCanvasQuestionCardProps) {
    // While being dragged, an active card renders as a clean collapsed summary
    // (no clipped editor) and re-expands once the drag ends.
    const effectiveIsActive = isActive && !isDragging;
    const EditorComponent = getQuestionEditor(item.type);

    // Open state lives here (not in the drawer) so the root onClick below can
    // reset it on activation; the toggle button lives in the drawer.
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    // Correct-answer chip content — rendered on the collapsed badge row.
    const correctAnswers = getCorrectAnswerList(item.payload);

    const headerRow: ReactNode = (
        <div {...stylex.props(styles.header)}>
            <span
                data-canvas-drag-handle
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
            {effectiveIsActive ? (
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
                    <NumberInput
                        label="Points"
                        isLabelHidden
                        value={item.points}
                        onChange={(value) => onChange({ points: value })}
                        min={1}
                        units="pt"
                        width={76}
                        size="sm"
                        onClick={(event) => event.stopPropagation()}
                        style={{ flexShrink: 0 }}
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

    // Collapsed badge row — the points/difficulty/type chips sit left, with
    // the ✓ answer chip right-aligned at the row's end. Multiple-select stays
    // ONE chip too (✓ A + B + C, "+N more" when long) — the same grammar as
    // single-select, and `+` reads as "all of these" (AND), not alternatives.
    // Two-row collapsed card, so a narrow card never squeezes the question
    // out of sight.
    const collapsedMetaRow: ReactNode = !effectiveIsActive ? (
        <div {...stylex.props(styles.collapsedMeta)}>
            <span
                {...stylex.props(styles.metaChip)}
                style={{
                    backgroundColor: POINTS_APPEARANCE.bg,
                    color: POINTS_APPEARANCE.fg,
                }}
            >
                {item.points} pt
            </span>
            <span
                {...stylex.props(styles.metaChip)}
                style={{
                    backgroundColor: DIFFICULTY_APPEARANCE[item.difficulty].bg,
                    color: DIFFICULTY_APPEARANCE[item.difficulty].fg,
                }}
            >
                {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
            </span>
            <span
                {...stylex.props(styles.metaChip)}
                style={{
                    backgroundColor: QUESTION_TYPE_APPEARANCE[item.type].bg,
                    color: QUESTION_TYPE_APPEARANCE[item.type].fg,
                }}
            >
                {QUESTION_TYPE_OPTIONS.find((o) => o.value === item.type)?.label ?? item.type}
            </span>
            {correctAnswers && (
                <div {...stylex.props(styles.answerGroup)}>
                    <span
                        {...stylex.props(styles.answerChip)}
                        title={`Correct answer: ${correctAnswers.join(', ')}`}
                    >
                        ✓ {formatAnswerList(correctAnswers)}
                    </span>
                </div>
            )}
        </div>
    ) : null;

    return (
        <div
            ref={cardRef}
            {...stylex.props(
                styles.card,
                effectiveIsActive && styles.cardActive,
                isDragging && styles.cardDragging,
            )}
            onClick={() => {
                // Reset the metadata drawer when a collapsed card is clicked —
                // the event that owns the activation change (each activation
                // starts with the drawer closed). Resetting here instead of an
                // effect watching the `isActive` prop avoids adjusting state
                // after the prop changes. Keyed on `isActive`, not
                // `effectiveIsActive`, so a drag (which flips the latter while
                // `isActive` stays true) keeps the drawer open through its
                // collapse/re-expand cycle instead of silently closing it.
                // Note: programmatic reactivations (e.g. `focusFirstInvalid`
                // on save failure) bypass this click reset.
                if (!isActive) setIsDrawerOpen(false);
                onActivate();
            }}
            role="group"
            aria-label={`Question ${index + 1}`}
        >
            {headerRow}
            {collapsedMetaRow}

            {effectiveIsActive ? (
                <div {...stylex.props(styles.body)} onClick={(event) => event.stopPropagation()}>
                    {/* Fixed 2 rows (no auto-grow): the canvas ResizeObserver
                        treats any wrapper height change as a layout event and
                        reflows every card below it, so a per-keystroke growing
                        textarea would fight the accordion with constant tweens. */}
                    <TextArea
                        label={`Question ${index + 1} prompt`}
                        labelHidden
                        value={item.prompt}
                        onChange={(value) => onChange({ prompt: value })}
                        placeholder="Type the question prompt…"
                        required
                        rows={2}
                    />
                    <EditorComponent
                        value={item.payload as never}
                        onChange={(payload: never) => onChange({ payload })}
                    />

                    <QuizCanvasAnswerMetadataDrawer
                        item={item}
                        onChange={onChange}
                        isDrawerOpen={isDrawerOpen}
                        onToggle={() => setIsDrawerOpen((prev) => !prev)}
                        heightAnimRef={heightAnimRef}
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
