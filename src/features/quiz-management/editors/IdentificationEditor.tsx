import { useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Plus, X } from 'lucide-react';
import type { IdentificationPayload } from '../../../domain/quiz/models/AnswerPayload';
import { Button } from '../../../shared/ui/Button/Button';
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
    altRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    altInput: {
        flex: 1,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
});

interface IdentificationEditorProps {
    value: IdentificationPayload;
    onChange: (payload: IdentificationPayload) => void;
}

export function IdentificationEditor({ value, onChange }: IdentificationEditorProps) {
    const alternatives = value.acceptedAlternatives ?? [];

    const updateAlternative = (index: number, text: string) => {
        const updated = [...alternatives];
        updated[index] = text;
        onChange({ ...value, acceptedAlternatives: updated });
    };

    const addAlternative = () => {
        onChange({ ...value, acceptedAlternatives: [...alternatives, ''] });
    };

    const removeAlternative = (index: number) => {
        const updated = alternatives.filter((_, i) => i !== index);
        onChange({ ...value, acceptedAlternatives: updated });
    };

    const alternativeItems = useMemo(() => {
        return (value.acceptedAlternatives ?? []).map((text, idx) => ({
            id: `alt-${idx}-${text}`,
            text,
            index: idx,
        }));
    }, [value.acceptedAlternatives]);

    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.section)}>
                <Input
                    label="Correct answer"
                    value={value.correctAnswer}
                    onChange={(v) => onChange({ ...value, correctAnswer: v })}
                    placeholder="Primary correct answer"
                    required
                />
            </div>

            <div {...stylex.props(styles.section)}>
                <p {...stylex.props(styles.sectionLabel)}>Accepted alternatives (optional)</p>
                <p {...stylex.props(styles.hint)}>
                    Alternative answers are matched case-insensitively.
                </p>
                {alternativeItems.map((item) => (
                    <div key={item.id} {...stylex.props(styles.altRow)}>
                        <div {...stylex.props(styles.altInput)}>
                            <Input
                                label={`Alternative ${item.index + 1}`}
                                labelHidden
                                value={item.text}
                                onChange={(v) => updateAlternative(item.index, v)}
                                placeholder={`Alternative ${item.index + 1}`}
                            />
                        </div>
                        <Button
                            label={`Remove alternative ${item.index + 1}`}
                            variant="ghost"
                            icon={<X size={14} />}
                            isIconOnly
                            onClick={() => removeAlternative(item.index)}
                        />
                    </div>
                ))}
                <Button
                    label="Add alternative"
                    variant="secondary"
                    icon={<Plus size={14} />}
                    onClick={addAlternative}
                >
                    Add Alternative
                </Button>
            </div>
        </div>
    );
}
