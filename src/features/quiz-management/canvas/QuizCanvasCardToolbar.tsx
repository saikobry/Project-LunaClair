import * as stylex from '@stylexjs/stylex';
import { ArrowDown, ArrowUp, Copy, Library, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';
import { useFocusMode } from '../../../app/providers/FocusModeContext';

const desktop = '@media (min-width: 640px)';
const mobile = '@media (max-width: 639px)';

const styles = stylex.create({
    cardToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-low)',
        zIndex: 10,
        // Visual-only dock: positioning is owned by the `toolbarAbsoluteWrapper`
        // lane in QuizCanvasToolbarLane (absolute top: 0 + GSAP y glide).
        // Desktop/tablet (≥640px): vertical icon column.
        [desktop]: {
            flexDirection: 'column',
        },
        // Mobile (<640px): sleek floating glassmorphism bottom pill. It floats
        // above the app bottom nav (`calc(84px + safe-area)`) and drops to the
        // bottom edge in Focus Mode when the nav is hidden; zIndex 149 stays
        // under the Focus Mode restore FAB (zIndex 150) so it stays reachable.
        [mobile]: {
            position: 'fixed',
            bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
            left: 16,
            right: 16,
            // Center the actions toward the middle of the bar instead of
            // spreading them edge-to-edge (`space-around`) — a centered
            // cluster keeps the thumb within natural reach. The gap bump is
            // scoped to the pill so the desktop/tablet column keeps its 4px.
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            // Older Safari (pre-18) needs the -webkit- prefix for the glass effect.
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.16)',
            flexDirection: 'row',
            zIndex: 149,
            transition: 'bottom 0.35s ease',
        },
    },
    // Focus Mode: the bottom nav is hidden — drop down to the bottom edge.
    cardToolbarFocus: {
        [mobile]: {
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        },
    },
});

interface QuizCanvasCardToolbarProps {
    index: number;
    totalItems: number;
    onAddBelow: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onImportFromBank: () => void;
    onDelete: () => void;
    /** Overrides the Focus Mode state from context when provided. */
    isFocusMode?: boolean;
}

export function QuizCanvasCardToolbar({
    index,
    totalItems,
    onAddBelow,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onImportFromBank,
    onDelete,
    isFocusMode,
}: QuizCanvasCardToolbarProps) {
    const { isFocusMode: contextIsFocusMode } = useFocusMode();
    const focusMode = isFocusMode ?? contextIsFocusMode;

    return (
        <div
            {...stylex.props(
                styles.cardToolbar,
                focusMode && styles.cardToolbarFocus,
            )}
        >
            <Button
                label="Add question below"
                variant="secondary"
                icon={<Plus size={14} />}
                isIconOnly
                tooltip="Add below"
                onClick={onAddBelow}
            />
            <Button
                label="Duplicate question"
                variant="secondary"
                icon={<Copy size={14} />}
                isIconOnly
                isDisabled={index === -1}
                tooltip="Duplicate"
                onClick={onDuplicate}
            />
            <Button
                label="Move question up"
                variant="secondary"
                icon={<ArrowUp size={14} />}
                isIconOnly
                isDisabled={index <= 0}
                tooltip="Move up"
                onClick={onMoveUp}
            />
            <Button
                label="Move question down"
                variant="secondary"
                icon={<ArrowDown size={14} />}
                isIconOnly
                isDisabled={index === -1 || index === totalItems - 1}
                tooltip="Move down"
                onClick={onMoveDown}
            />
            <Button
                label="Import from Question Bank"
                variant="secondary"
                icon={<Library size={14} />}
                isIconOnly
                tooltip="Import from Bank"
                onClick={onImportFromBank}
            />
            <Button
                label="Delete question"
                variant="danger"
                icon={<Trash2 size={14} />}
                isIconOnly
                isDisabled={index === -1}
                tooltip="Delete"
                onClick={onDelete}
            />
        </div>
    );
}
