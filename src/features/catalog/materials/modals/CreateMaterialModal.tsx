import { useState, useEffect, useContext } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button/Button';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { styles } from '../../shared/styles/library.stylex';
import type { Subject, Term } from '../../../../domain/library';

const selectStyles = stylex.create({
    select: {
        padding: '10px 14px',
        fontSize: 14,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        borderRadius: 8,
        color: 'var(--color-text-primary)',
        backgroundColor: 'var(--color-background-surface)',
        outlineStyle: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease',
        ':focus': {
            borderColor: 'var(--color-accent)',
            boxShadow: '0 0 0 3px var(--color-overlay-hover)',
        },
    },
});

interface CreateMaterialModalProps {
    subjects: Subject[];
    /** Pre-selected subject ID (e.g. when opened from SubjectWorkspace) */
    initialSubjectId?: string;
    onSave: (title: string, description: string, subjectId?: string | null, termId?: string | null) => void;
    onClose: () => void;
}

export default function CreateMaterialModal({
    subjects,
    initialSubjectId,
    onSave,
    onClose,
}: CreateMaterialModalProps) {
    const context = useContext(ApplicationContext);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
        initialSubjectId ?? null,
    );
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const [availableTerms, setAvailableTerms] = useState<Term[]>([]);

    // Resolve terms for the selected subject via SubjectTermRepository
    useEffect(() => {
        if (!selectedSubjectId || !context) return;
        let cancelled = false;
        context.infrastructure.repositories.subjectTerm.getTermsBySubject(selectedSubjectId).then((terms) => {
            if (!cancelled) setAvailableTerms(terms);
        });
        return () => { cancelled = true; };
    }, [selectedSubjectId, context]);

    const handleSubjectChange = (value: string) => {
        const newSubjectId = value === '__unassigned__' ? null : value;
        setSelectedSubjectId(newSubjectId);
        setSelectedTermId(null);
        if (!newSubjectId) {
            setAvailableTerms([]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            onSave(
                title.trim(),
                description.trim(),
                selectedSubjectId,
                selectedTermId,
            );
        }
    };

    return (
        <Dialog isOpen onClose={onClose} title="New Material" width={460}>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    marginTop: 16,
                }}
            >
                <div {...stylex.props(styles.fieldGroup)}>
                    <Input
                        label="Title"
                        value={title}
                        onChange={(value) => setTitle(value)}
                        placeholder="Enter material title"
                        autoFocus
                    />
                </div>

                <div {...stylex.props(styles.fieldGroup)}>
                    <label {...stylex.props(styles.label)} htmlFor="create-desc">
                        Description
                    </label>
                    <textarea
                        id="create-desc"
                        {...stylex.props(styles.textarea)}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description (optional)"
                        rows={3}
                    />
                </div>

                {/* Subject selector */}
                <div {...stylex.props(styles.fieldGroup)}>
                    <label {...stylex.props(styles.label)} htmlFor="create-subject">
                        Subject
                    </label>
                    <select
                        id="create-subject"
                        {...stylex.props(selectStyles.select)}
                        value={selectedSubjectId ?? '__unassigned__'}
                        onChange={(e) => handleSubjectChange(e.target.value)}
                    >
                        <option value="__unassigned__">Unassigned / General Library</option>
                        {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                                {subject.title}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Term selector — only shown when a subject with terms is selected */}
                {availableTerms.length > 0 && (
                    <div {...stylex.props(styles.fieldGroup)}>
                        <label {...stylex.props(styles.label)} htmlFor="create-term">
                            Term
                        </label>
                        <select
                            id="create-term"
                            {...stylex.props(selectStyles.select)}
                            value={selectedTermId ?? ''}
                            onChange={(e) =>
                                setSelectedTermId(e.target.value || null)
                            }
                        >
                            <option value="">No term</option>
                            {availableTerms.map((term) => (
                                <option key={term.id} value={term.id}>
                                    {term.title}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div {...stylex.props(styles.modalActions)}>
                    <Button label="Cancel" variant="secondary" onClick={onClose} />
                    <Button
                        label="Create Material"
                        variant="primary"
                        type="submit"
                        isDisabled={!title.trim()}
                    />
                </div>
            </form>
        </Dialog>
    );
}
