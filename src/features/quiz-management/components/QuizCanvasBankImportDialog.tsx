import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { Question } from '../../../domain/quiz/Question';
import { Button } from '../../../shared/ui/Button/Button';
import { Checkbox } from '../../../shared/ui/Checkbox/Checkbox';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';

const styles = stylex.create({
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 380,
        overflowY: 'auto',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 13,
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
    },
    rowSelected: {
        borderColor: 'var(--color-accent)',
        backgroundColor: 'var(--color-accent-muted)',
    },
    meta: {
        fontSize: 11,
        color: 'var(--color-text-disabled)',
        flexShrink: 0,
    },
    empty: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
        padding: '24px 0',
        margin: 0,
    },
});

interface QuizCanvasBankImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    questions: Question[];
    /** Question ids already present on the canvas (excluded from import). */
    usedQuestionIds: string[];
    onImport: (questions: Question[]) => void;
}

/**
 * Picker for importing existing Question Bank questions onto the canvas.
 * Imported cards reference their bank `questionId`, so edits save back
 * to the single source of truth.
 */
export function QuizCanvasBankImportDialog({
    isOpen,
    onClose,
    questions,
    usedQuestionIds,
    onImport,
}: QuizCanvasBankImportDialogProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const used = new Set(usedQuestionIds);
    const available = questions.filter((question) => question.status !== 'archived' && !used.has(question.id));

    const toggle = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((qid) => qid !== id) : [...prev, id]));
    };

    const selectedSet = new Set(selectedIds);

    const handleImport = () => {
        const picked = available.filter((question) => selectedSet.has(question.id));
        onImport(picked);
        setSelectedIds([]);
        onClose();
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={() => { setSelectedIds([]); onClose(); }}
            title="Import from Question Bank"
            width={560}
            maxHeight="80vh"
            purpose="form"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button label="Cancel" variant="secondary" onClick={() => { setSelectedIds([]); onClose(); }}>
                        Cancel
                    </Button>
                    <Button
                        label={`Import ${selectedIds.length} question${selectedIds.length === 1 ? '' : 's'}`}
                        variant="primary"
                        isDisabled={selectedIds.length === 0}
                        onClick={handleImport}
                    >
                        Import {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                    </Button>
                </div>
            }
        >
            {available.length === 0 ? (
                <p {...stylex.props(styles.empty)}>
                    No unused questions in the bank. Create questions in the Question Bank tab first.
                </p>
            ) : (
                <div {...stylex.props(styles.list)}>
                    {available.map((question) => {
                        const isSelected = selectedSet.has(question.id);
                        return (
                            <div
                                key={question.id}
                                {...stylex.props(styles.row, isSelected && styles.rowSelected)}
                            >
                                <Checkbox
                                    label={question.prompt}
                                    isChecked={isSelected}
                                    onChange={() => toggle(question.id)}
                                    size="sm"
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <span {...stylex.props(styles.meta)}>v{question.version}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </Dialog>
    );
}
