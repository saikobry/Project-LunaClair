import * as stylex from '@stylexjs/stylex';
import { ArrowDown, ArrowUp, Copy, Library, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';

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
        // Mobile: fixed bottom navbar, centered above the canvas padding.
        [mobile]: {
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            flexDirection: 'row',
            zIndex: 100,
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
}: QuizCanvasCardToolbarProps) {
    return (
        <div {...stylex.props(styles.cardToolbar)}>
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
