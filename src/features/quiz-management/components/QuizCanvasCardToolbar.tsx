import * as stylex from '@stylexjs/stylex';
import { ArrowDown, ArrowUp, Copy, Library, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';
import { useFocusMode } from '../../../app/providers/FocusModeContext';

const desktop = '@media (min-width: 769px)';
const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
    cardToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
        boxShadow: 'var(--shadow-med)',
        zIndex: 3,
        // Google Forms style: docked vertically to the right of the active card.
        [desktop]: {
            position: 'absolute',
            right: -52,
            top: 0,
            flexDirection: 'column',
        },
        // Mobile: fixed bottom navbar, centered above the app bottom nav.
        [mobile]: {
            position: 'fixed',
            bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            flexDirection: 'row',
            // Stays under the Focus Mode restore FAB (zIndex 150) so the
            // logo button always remains reachable in Focus Mode.
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
                tooltip="Duplicate"
                onClick={onDuplicate}
            />
            <Button
                label="Move question up"
                variant="secondary"
                icon={<ArrowUp size={14} />}
                isIconOnly
                isDisabled={index === 0}
                tooltip="Move up"
                onClick={onMoveUp}
            />
            <Button
                label="Move question down"
                variant="secondary"
                icon={<ArrowDown size={14} />}
                isIconOnly
                isDisabled={index === totalItems - 1}
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
                tooltip="Delete"
                onClick={onDelete}
            />
        </div>
    );
}
