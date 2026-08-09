import { forwardRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input/Input';
import { NumberInput } from '../../../shared/ui/NumberInput/NumberInput';

const styles = stylex.create({
    metaCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
    },
    passingRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 14,
        borderTop: '1px solid var(--color-border)',
    },
    passingLabel: {
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
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
            <div ref={ref}>
                <Card style={{ padding: 0 }}>
                    <div {...stylex.props(styles.metaCard)}>
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
                            <NumberInput
                                label="Passing percentage"
                                isLabelHidden
                                value={passingPercentage}
                                onChange={(value) =>
                                    onChange({ passingPercentage: Math.min(100, Math.max(0, value)) })
                                }
                                min={0}
                                max={100}
                                units="%"
                                width={90}
                                size="sm"
                            />
                        </div>
                    </div>
                </Card>
            </div>
        );
    },
);

