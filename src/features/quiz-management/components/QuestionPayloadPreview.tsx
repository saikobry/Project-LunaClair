import * as stylex from '@stylexjs/stylex';
import type { QuestionAnswerPayload } from '../../../domain/quiz/AnswerPayload';

const styles = stylex.create({
    detailLabel: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: 'var(--color-text-disabled)',
    },
    choiceList: {
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    choiceItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        padding: '4px 8px',
        borderRadius: 6,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
    choiceItemCorrect: {
        backgroundColor: 'var(--color-success-muted)',
        color: '#166534',
        fontWeight: 600,
    },
    correctIndicator: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
    },
    correctIndicatorRadio: {
        backgroundColor: 'var(--color-success)',
        color: '#fff',
    },
    correctIndicatorCheck: {
        backgroundColor: 'var(--color-success)',
        color: '#fff',
    },
    answerBlock: {
        fontSize: 13,
        padding: '6px 10px',
        borderRadius: 6,
        backgroundColor: 'var(--color-success-muted)',
        color: '#166534',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
    },
    templateText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--color-text-secondary)',
        padding: '6px 10px',
        borderRadius: 6,
        backgroundColor: 'var(--color-background-muted)',
        lineHeight: 1.5,
    },
    blankAnswer: {
        fontSize: 13,
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
        fontWeight: 600,
        fontFamily: 'monospace',
    },
});

export interface QuestionPayloadPreviewProps {
    payload: QuestionAnswerPayload;
}

export function QuestionPayloadPreview({ payload }: QuestionPayloadPreviewProps) {
    switch (payload.type) {
        case 'multiple_choice': {
            const choices = payload.choices ?? [];
            const ci = payload.correctIndex;
            return (
                <>
                    <div {...stylex.props(styles.detailLabel)}>Choices</div>
                    <ul {...stylex.props(styles.choiceList)}>
                        {choices.map((choice: string, i: number) => (
                            <li key={i} {...stylex.props(styles.choiceItem, i === ci && styles.choiceItemCorrect)}>
                                <span {...stylex.props(styles.correctIndicator, styles.correctIndicatorRadio)}>
                                    {i === ci ? '✓' : ''}
                                </span>
                                {choice || <span style={{ opacity: 0.4 }}>Empty</span>}
                            </li>
                        ))}
                    </ul>
                </>
            );
        }
        case 'multiple_select': {
            const choices = payload.choices ?? [];
            const correctIndices: number[] = payload.correctIndices ?? [];
            const correctSet = new Set(correctIndices);
            return (
                <>
                    <div {...stylex.props(styles.detailLabel)}>Choices</div>
                    <ul {...stylex.props(styles.choiceList)}>
                        {choices.map((choice: string, i: number) => (
                            <li key={i} {...stylex.props(styles.choiceItem, correctSet.has(i) && styles.choiceItemCorrect)}>
                                <span {...stylex.props(styles.correctIndicator, styles.correctIndicatorCheck)}>
                                    {correctSet.has(i) ? '✓' : ''}
                                </span>
                                {choice || <span style={{ opacity: 0.4 }}>Empty</span>}
                            </li>
                        ))}
                    </ul>
                </>
            );
        }
        case 'true_false':
            return (
                <>
                    <div {...stylex.props(styles.detailLabel)}>Correct Answer</div>
                    <span {...stylex.props(styles.answerBlock)}>
                        {payload.correctAnswer ? 'True' : 'False'}
                    </span>
                </>
            );
        case 'identification':
            return (
                <>
                    <div {...stylex.props(styles.detailLabel)}>Answer</div>
                    <span {...stylex.props(styles.answerBlock)}>{payload.correctAnswer}</span>
                    {payload.acceptedAlternatives && payload.acceptedAlternatives.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-disabled)', marginTop: 2 }}>
                            Accepted alternatives: {payload.acceptedAlternatives.join(', ')}
                        </div>
                    )}
                </>
            );
        case 'fill_in_blank':
            return (
                <>
                    <div {...stylex.props(styles.detailLabel)}>Template</div>
                    <div {...stylex.props(styles.templateText)}>
                        {payload.template || <span style={{ opacity: 0.4 }}>No template</span>}
                    </div>
                    {payload.blanks && payload.blanks.length > 0 && (
                        <>
                            <div {...stylex.props(styles.detailLabel)} style={{ marginTop: 4 }}>Answers</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {payload.blanks.map((answer: string, i: number) => (
                                    <span key={`blank-${i}-${answer}`} {...stylex.props(styles.blankAnswer)}>
                                        {i + 1}. {answer}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </>
            );
        default:
            return null;
    }
}
