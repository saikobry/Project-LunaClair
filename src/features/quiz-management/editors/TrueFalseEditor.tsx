import * as stylex from '@stylexjs/stylex';
import type { TrueFalsePayload } from '../../../domain/quiz/AnswerPayload';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    optionRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        border: '1px solid #e5e4e7',
        borderRadius: 8,
        cursor: 'pointer',
    },
    optionRowActive: {
        borderColor: '#6366f1',
        backgroundColor: '#eef2ff',
    },
    radio: {
        width: 16,
        height: 16,
        accentColor: '#6366f1',
        cursor: 'pointer',
    },
    label: {
        fontSize: 14,
        fontWeight: 500,
        color: '#08060d',
    },
    hint: {
        fontSize: 12,
        color: '#6b6375',
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
            <label
                {...stylex.props(styles.optionRow, value.correctAnswer === true && styles.optionRowActive)}
            >
                <input
                    type="radio"
                    name="trueFalse"
                    checked={value.correctAnswer === true}
                    onChange={() => onChange({ ...value, correctAnswer: true })}
                    {...stylex.props(styles.radio)}
                />
                <span {...stylex.props(styles.label)}>True</span>
            </label>
            <label
                {...stylex.props(styles.optionRow, value.correctAnswer === false && styles.optionRowActive)}
            >
                <input
                    type="radio"
                    name="trueFalse"
                    checked={value.correctAnswer === false}
                    onChange={() => onChange({ ...value, correctAnswer: false })}
                    {...stylex.props(styles.radio)}
                />
                <span {...stylex.props(styles.label)}>False</span>
            </label>
        </div>
    );
}
