import { forwardRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input/Input';
import { NumberInput } from '../../../shared/ui/NumberInput/NumberInput';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';

const styles = stylex.create({
    metaCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 20,
    },
    settingsSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingTop: 14,
        borderTop: '1px solid var(--color-border)',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
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
    passingHint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
});

interface QuizCanvasMetaCardProps {
    title: string;
    description: string;
    passingPercentage: number;
    /** Sum of all question-card points on the canvas — feeds the points-aware helper. */
    totalPoints: number;
    titleError?: string;
    onChange: (patch: { title?: string; description?: string; passingPercentage?: number }) => void;
}

export const QuizCanvasMetaCard = forwardRef<HTMLDivElement, QuizCanvasMetaCardProps>(
    function QuizCanvasMetaCard({ title, description, passingPercentage, totalPoints, titleError, onChange }, ref) {
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
                            maxLength={80}
                            statusMessage={titleError}
                        />
                        <TextArea
                            label="Description (optional)"
                            value={description}
                            onChange={(value) => onChange({ description: value || undefined })}
                            placeholder="Brief description of this quiz"
                            rows={3}
                        />
                        <div {...stylex.props(styles.settingsSection)}>
                            <p {...stylex.props(styles.sectionLabel)}>Settings</p>
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
                            <p {...stylex.props(styles.passingHint)}>
                                {/* Points-aware helper: the engine grades by earned points ÷
                                    total points (see AssessmentService), NOT question count — so
                                    a count-based line would silently lie whenever weights are
                                    mixed. Derived one-way from the stored percentage; falls back
                                    to the plain percentage while the canvas has no questions. */}
                                {totalPoints > 0
                                    ? `Learners need to earn ${Math.ceil((passingPercentage / 100) * totalPoints)} of ${totalPoints} points (${passingPercentage}%) to pass.`
                                    : `Learners need ${passingPercentage}% to pass.`}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        );
    },
);
