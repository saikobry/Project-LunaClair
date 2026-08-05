import * as stylex from '@stylexjs/stylex';
import { ArrowLeft, Check, Clock, Eye, Settings, Sparkles } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        backgroundColor: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
        // Mobile: collapse padding/gap so the Save Quiz button stays visible.
        [mobile]: {
            padding: '8px 12px',
            gap: 8,
        },
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 320,
        minWidth: 0,
        [mobile]: {
            maxWidth: 140,
        },
    },
    autosaveBadge: {
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        flexShrink: 0,
    },
    autosaveBadgeSaved: {
        color: 'var(--color-success)',
    },
    spacer: {
        flex: 1,
    },
    slotDivider: {
        width: 1,
        height: 22,
        backgroundColor: 'var(--color-border)',
        flexShrink: 0,
    },
    // Reserved (disabled) action slots and dividers are dropped on mobile
    // to keep the Save Quiz button unclipped.
    hiddenOnMobile: {
        [mobile]: {
            display: 'none',
        },
    },
});

type SaveButtonState = 'idle' | 'saving' | 'saved';

interface QuizCanvasHeaderProps {
    draftTitle: string;
    autosaveLabel: string;
    autosaveStatus: string;
    saveState: SaveButtonState;
    saveLabel: string;
    onBack: () => void;
    onSave: () => void;
}

export function QuizCanvasHeader({
    draftTitle,
    autosaveLabel,
    autosaveStatus,
    saveState,
    saveLabel,
    onBack,
    onSave,
}: QuizCanvasHeaderProps) {
    return (
        <header {...stylex.props(styles.header)}>
            <Button
                label="Back to quiz catalog"
                variant="secondary"
                icon={<ArrowLeft size={14} />}
                onClick={onBack}
            >
                Back
            </Button>
            <p {...stylex.props(styles.headerTitle)}>
                {draftTitle || 'Untitled quiz'}
            </p>
            {autosaveLabel && (
                <span
                    {...stylex.props(
                        styles.autosaveBadge,
                        autosaveStatus === 'saved' && styles.autosaveBadgeSaved,
                    )}
                >
                    {autosaveLabel}
                </span>
            )}
            <div {...stylex.props(styles.spacer)} />
            <Button
                label="AI generation (coming soon)"
                variant="ghost"
                icon={<Sparkles size={15} />}
                isIconOnly
                isDisabled
                tooltip="AI generation — coming soon"
                {...stylex.props(styles.hiddenOnMobile)}
            />
            <div {...stylex.props(styles.slotDivider, styles.hiddenOnMobile)} />
            <Button
                label="Preview (coming soon)"
                variant="ghost"
                icon={<Eye size={15} />}
                isIconOnly
                isDisabled
                tooltip="Preview — coming soon"
                {...stylex.props(styles.hiddenOnMobile)}
            />
            <Button
                label="History (coming soon)"
                variant="ghost"
                icon={<Clock size={15} />}
                isIconOnly
                isDisabled
                tooltip="History — coming soon"
                {...stylex.props(styles.hiddenOnMobile)}
            />
            <Button
                label="Settings (coming soon)"
                variant="ghost"
                icon={<Settings size={15} />}
                isIconOnly
                isDisabled
                tooltip="Settings — coming soon"
                {...stylex.props(styles.hiddenOnMobile)}
            />
            <div {...stylex.props(styles.slotDivider, styles.hiddenOnMobile)} />
            <Button
                label="Save quiz"
                variant="primary"
                icon={saveState === 'saved' ? <Check size={14} /> : undefined}
                isDisabled={saveState !== 'idle'}
                onClick={onSave}
            >
                {saveLabel}
            </Button>
        </header>
    );
}
