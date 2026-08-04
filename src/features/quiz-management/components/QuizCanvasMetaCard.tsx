import { forwardRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Input } from '../../../shared/ui/Input/Input';

const styles = stylex.create({
    metaCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 20,
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
    },
    passingRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    passingLabel: {
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    passingInput: {
        width: 84,
        padding: '6px 8px',
        fontSize: 13,
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-background)',
    },
});

interface QuizCanvasMetaCardProps {
    title: string;
    description: string;
    passingPercentage: number;
    titleError?: string;
    onChange: (patch: { title?: string; description?: string; passingPercentage?: number }) => void;
}

export const QuizCanvasMetaCard = forwardRef<HTMLDivElement, QuizCanvasMetaCardProps>(
    function QuizCanvasMetaCard({ title, description, passingPercentage, titleError, onChange }, ref) {
        return (
            <div {...stylex.props(styles.metaCard)} ref={ref}>
                <Input
                    label="Quiz title"
                    value={title}
                    onChange={(value) => onChange({ title: value })}
                    placeholder="e.g. Chapter 4 Review Quiz"
                    required
                    statusMessage={titleError}
                />
                <Input
                    label="Description (optional)"
                    value={description}
                    onChange={(value) => onChange({ description: value || undefined })}
                    placeholder="Brief description of this quiz"
                />
                <div {...stylex.props(styles.passingRow)}>
                    <p {...stylex.props(styles.passingLabel)}>Passing percentage</p>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={passingPercentage}
                        onChange={(event) => {
                            const raw = event.target.value;
                            if (raw === '') {
                                onChange({ passingPercentage: 0 });
                                return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) return;
                            onChange({
                                passingPercentage: Math.min(100, Math.max(0, parsed)),
                            });
                        }}
                        {...stylex.props(styles.passingInput)}
                        aria-label="Passing percentage"
                    />
                    <p {...stylex.props(styles.passingLabel)}>%</p>
                </div>
            </div>
        );
    },
);
