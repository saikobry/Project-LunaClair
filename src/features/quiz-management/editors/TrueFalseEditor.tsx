import * as stylex from '@stylexjs/stylex';
import type { TrueFalsePayload } from '../../../domain/quiz/AnswerPayload';
import { CorrectAnswerIndicator } from '../components/CorrectAnswerIndicator/CorrectAnswerIndicator';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    optionRow: {
        // StyleX drops the `all` shorthand — write the native-button resets
        // explicitly or the UA's button chrome (background + border) leaks.
        appearance: 'none',
        font: 'inherit',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 14px',
        // `border` shorthand is dropped by StyleX 0.19 — use longhands so the
        // 1px transparent border (layout reservation, no visible ring) ships.
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        ':focus-visible': {
            outline: '2px solid var(--color-success)',
            outlineOffset: 2,
        },
    },
    optionRowActive: {
        borderColor: 'transparent',
        backgroundColor: 'var(--color-success-muted)',
    },
    label: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        flex: 1,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
});

interface TrueFalseEditorProps {
    value: TrueFalsePayload;
    onChange: (payload: TrueFalsePayload) => void;
}

export function TrueFalseEditor({ value, onChange }: TrueFalseEditorProps) {
    return (
        <div {...stylex.props(styles.container)}>
            <p {...stylex.props(styles.hint)}>Select the correct answer.</p>
            <button
                type="button"
                {...stylex.props(styles.optionRow, value.correctAnswer === true && styles.optionRowActive)}
                onClick={() => onChange({ ...value, correctAnswer: true })}
            >
                <CorrectAnswerIndicator
                    isSelected={value.correctAnswer === true}
                    onToggle={() => onChange({ ...value, correctAnswer: true })}
                    ariaLabel="Mark True as correct"
                    shape="circle"
                />
                <span {...stylex.props(styles.label)}>True</span>
            </button>
            <button
                type="button"
                {...stylex.props(styles.optionRow, value.correctAnswer === false && styles.optionRowActive)}
                onClick={() => onChange({ ...value, correctAnswer: false })}
            >
                <CorrectAnswerIndicator
                    isSelected={value.correctAnswer === false}
                    onToggle={() => onChange({ ...value, correctAnswer: false })}
                    ariaLabel="Mark False as correct"
                    shape="circle"
                />
                <span {...stylex.props(styles.label)}>False</span>
            </button>
        </div>
    );
}
