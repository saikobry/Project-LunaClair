import * as stylex from '@stylexjs/stylex';
import type { FillBlankPayload } from '../../../domain/quiz/AnswerPayload';
import { Input } from '../../../shared/ui/Input';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    textarea: {
        width: '100%',
        minHeight: 80,
        padding: '10px 12px',
        fontSize: 14,
        fontFamily: 'inherit',
        border: '1px solid var(--color-border, #e5e4e7)',
        borderRadius: 8,
        resize: 'vertical',
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-background-card, #ffffff)',
        boxSizing: 'border-box',
    },
    blanksList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
});

interface FillBlankEditorProps {
    value: FillBlankPayload;
    onChange: (payload: FillBlankPayload) => void;
}

export function FillBlankEditor({ value, onChange }: FillBlankEditorProps) {
    const blankCount = (value.template.match(/___/g) ?? []).length;

    const updateTemplate = (template: string) => {
        const newCount = (template.match(/___/g) ?? []).length;
        const blanks = [...value.blanks];
        while (blanks.length < newCount) blanks.push('');
        blanks.length = newCount;
        onChange({ ...value, template, blanks });
    };

    const updateBlank = (index: number, text: string) => {
        const blanks = [...value.blanks];
        blanks[index] = text;
        onChange({ ...value, blanks });
    };

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.section)}>
                <p {...stylex.props(styles.sectionLabel)}>Template</p>
                <p {...stylex.props(styles.hint)}>
                    Use <code>___</code> (three underscores) to mark each blank position.
                </p>
                <textarea
                    value={value.template}
                    onChange={(e) => updateTemplate(e.target.value)}
                    placeholder="The ___ is the largest organ in the body."
                    {...stylex.props(styles.textarea)}
                    aria-label="Fill-in-the-blank template"
                />
            </div>

            {blankCount > 0 && (
                <div {...stylex.props(styles.section)}>
                    <p {...stylex.props(styles.sectionLabel)}>
                        Answers for blanks ({blankCount} found)
                    </p>
                    <div {...stylex.props(styles.blanksList)}>
                        {Array.from({ length: blankCount }, (_, i) => (
                            <Input
                                key={i}
                                label={`Blank ${i + 1}`}
                                value={value.blanks[i] ?? ''}
                                onChange={(v) => updateBlank(i, v)}
                                placeholder={`Answer for blank ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
