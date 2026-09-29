import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuestionEditorDialog } from '../QuestionEditorDialog';
import type { Question } from '../../../../domain/quiz/models/Question';

const mockShowToast = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
    useToast: () => ({ showToast: mockShowToast }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../../shared/ui/Selector/Selector', () => ({
    Selector: ({ label, value, onChange, options, 'aria-label': ariaLabel }: any) => (
        <div>
            <label htmlFor={`select-${label}`}>{label}</label>
            <select
                id={`select-${label}`}
                aria-label={ariaLabel || label}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    ),
}));

vi.mock('../../../../shared/ui/Dialog/Dialog', () => ({
    Dialog: ({ isOpen, children, title, footer }: any) => {
        if (!isOpen) return null;
        return (
            <div role="dialog" aria-label={title}>
                {title && <h2>{title}</h2>}
                <div>{children}</div>
                {footer && <div>{footer}</div>}
            </div>
        );
    },
}));

describe('QuestionEditorDialog', () => {
    let mockOnClose: ReturnType<typeof vi.fn>;
    let mockOnSave: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnClose = vi.fn();
        // The dialog now awaits the write boundary's result, so a bare `vi.fn()` (resolving
        // `undefined`) would read as a refusal. Default to an accepted write.
        mockOnSave = vi.fn().mockResolvedValue({ success: true, question: { id: 'q-saved' } });
    });

    const renderDialog = (props: Partial<Parameters<typeof QuestionEditorDialog>[0]> = {}) => {
        return render(
            <QuestionEditorDialog
                isOpen={true}
                onClose={mockOnClose as any}
                materialId="mat-1"
                onSave={mockOnSave as any}
                {...props}
            />,
        );
    };

    it('renders in create mode with type selector and default values', () => {
        renderDialog();

        expect(screen.getByText('New Question')).toBeInTheDocument();
        expect(screen.getByText('Question type')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter the question prompt')).toBeInTheDocument();
        expect(screen.getByText('Difficulty')).toBeInTheDocument();
        expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Default 1 pt
    });

    it('disables save button when prompt is empty and enables when prompt is provided', () => {
        renderDialog();

        const createButton = screen.getByRole('button', { name: /Create Question/i });
        expect(createButton).toBeDisabled();

        const promptInput = screen.getByPlaceholderText('Enter the question prompt');
        fireEvent.change(promptInput, { target: { value: 'What is photosynthesis?' } });

        expect(createButton).not.toBeDisabled();
    });

    it('submits CreateQuestionInput payload on save in create mode', async () => {
        renderDialog();

        const promptInput = screen.getByPlaceholderText('Enter the question prompt');
        fireEvent.change(promptInput, { target: { value: 'What is cellular respiration?' } });

        const choice1 = screen.getByPlaceholderText('Choice 1');
        fireEvent.change(choice1, { target: { value: 'Produces ATP' } });

        const choice2 = screen.getByPlaceholderText('Choice 2');
        fireEvent.change(choice2, { target: { value: 'Consumes ATP' } });

        const pointsInput = screen.getByDisplayValue('1');
        fireEvent.change(pointsInput, { target: { value: '3' } });

        const explanationInput = screen.getByPlaceholderText('Shown to learners after answering');
        fireEvent.change(explanationInput, { target: { value: 'ATP is the energy currency.' } });

        const createButton = screen.getByRole('button', { name: /Create Question/i });
        // Awaited: the dialog waits for the write boundary before it may claim success.
        await act(async () => {
            fireEvent.click(createButton);
        });

        expect(mockOnSave).toHaveBeenCalledWith({
            materialId: 'mat-1',
            type: 'multiple_choice',
            prompt: 'What is cellular respiration?',
            payload: {
                type: 'multiple_choice',
                choices: ['Produces ATP', 'Consumes ATP'],
                correctIndex: 0,
            },
            difficulty: 'medium',
            points: 3,
            explanation: 'ATP is the energy currency.',
            tags: undefined,
            status: 'draft',
        });
        expect(mockShowToast).toHaveBeenCalledWith('Question created successfully', { intent: 'success' });
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('renders in edit mode, locks type selector, and emits UpdateQuestionInput on save', async () => {
        const existingQuestion: Question = {
            id: 'q-exist-1',
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Is DNA double-stranded?',
            payload: { type: 'true_false', correctAnswer: true },
            difficulty: 'easy',
            points: 2,
            explanation: 'DNA is a double helix.',
            tags: ['genetics', 'dna'],
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };

        renderDialog({ question: existingQuestion });

        expect(screen.getByText('Edit Question')).toBeInTheDocument();
        // Type selector is omitted in edit mode
        expect(screen.queryByText('Question type')).not.toBeInTheDocument();

        const promptInput = screen.getByPlaceholderText('Enter the question prompt');
        expect(promptInput).toHaveValue('Is DNA double-stranded?');

        fireEvent.change(promptInput, { target: { value: 'Is RNA normally double-stranded?' } });

        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        expect(mockOnSave).toHaveBeenCalledWith(
            {
                prompt: 'Is RNA normally double-stranded?',
                payload: { type: 'true_false', correctAnswer: true },
                difficulty: 'easy',
                points: 2,
                explanation: 'DNA is a double helix.',
                tags: ['genetics', 'dna'],
            },
            'q-exist-1',
        );
        expect(mockShowToast).toHaveBeenCalledWith('Question updated', { intent: 'success' });
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('switches question type immediately when payload has no user data', () => {
        renderDialog();

        // Pristine payload (empty choices ['', ''])
        const typeSelector = screen.getByLabelText('Question type');
        fireEvent.change(typeSelector, { target: { value: 'true_false' } });

        // Switched without confirmation modal
        expect(screen.queryByText('Change Question Type?')).not.toBeInTheDocument();
        expect(screen.getByText('True')).toBeInTheDocument();
    });

    it('shows confirmation dialog when switching type with existing user data and confirms switch', () => {
        renderDialog();

        // Enter some choice data
        const choice1 = screen.getByPlaceholderText('Choice 1');
        fireEvent.change(choice1, { target: { value: 'Some answered text' } });

        // Request type change
        const typeSelector = screen.getByLabelText('Question type');
        fireEvent.change(typeSelector, { target: { value: 'identification' } });

        // Modal shows warning
        expect(screen.getByText('Change Question Type?')).toBeInTheDocument();

        // Confirm
        const confirmButton = screen.getByRole('button', { name: 'Change Type' });
        fireEvent.click(confirmButton);

        // Switched to identification
        expect(screen.queryByText('Change Question Type?')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Primary correct answer')).toBeInTheDocument();
    });

    it('cancels type switch when cancel is clicked on confirmation dialog', () => {
        renderDialog();

        // Enter some choice data
        const choice1 = screen.getByPlaceholderText('Choice 1');
        fireEvent.change(choice1, { target: { value: 'Some text' } });

        // Request type change
        const typeSelector = screen.getByLabelText('Question type');
        fireEvent.change(typeSelector, { target: { value: 'true_false' } });

        // Cancel
        const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
        fireEvent.click(cancelButtons[cancelButtons.length - 1]);

        // Retains multiple choice
        expect(screen.queryByText('Change Question Type?')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Choice 1')).toBeInTheDocument();
    });

    /**
     * The refusal surface. The dialog used to close on a success toast over whatever it had been
     * handed; it now waits for the write boundary and, on a refusal, stays open and names the
     * offending field. The messages are `validateQuestionPayload` findings rendered verbatim —
     * asserted literally so this component cannot drift into re-wording the rule.
     */
    describe('a refused write', () => {
        it('keeps the dialog open, names the offending field, and does not claim success', async () => {
            const errors = ['identification payload requires a non-empty "correctAnswer" string.'];
            mockOnSave.mockResolvedValue({ success: false, errors });

            renderDialog({
                question: {
                    id: 'q-broken',
                    materialId: 'mat-1',
                    type: 'identification',
                    prompt: 'Which organelle produces ATP?',
                    payload: { type: 'identification', correctAnswer: '' },
                    difficulty: 'medium',
                    points: 1,
                    status: 'draft',
                    version: 1,
                    createdAt: '2026-09-01T00:00:00.000Z',
                    updatedAt: '2026-09-01T00:00:00.000Z',
                },
            });

            fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

            expect(await screen.findByText(errors[0])).toBeInTheDocument();
            expect(mockShowToast).not.toHaveBeenCalledWith('Question updated', { intent: 'success' });
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('clears the refusal once the author edits the answer, and then accepts the save', async () => {
            const refusal =
                'fill_in_blank payload requires a "template" string with at least one "___" placeholder.';
            mockOnSave.mockResolvedValueOnce({ success: false, errors: [refusal] });

            // A row saved before the gate: openable, editable, and now repairable.
            const legacyQuestion: Question = {
                id: 'q-legacy-cloze',
                materialId: 'mat-1',
                type: 'fill_in_blank',
                prompt: 'Fill in the blank.',
                payload: { type: 'fill_in_blank', template: '', blanks: [] },
                difficulty: 'medium',
                points: 1,
                status: 'draft',
                version: 1,
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            };

            renderDialog({ question: legacyQuestion });

            const saveButton = screen.getByRole('button', { name: /Save Changes/i });

            // 1. Saving it as stored is refused and names the field.
            fireEvent.click(saveButton);
            expect(await screen.findByText(refusal)).toBeInTheDocument();
            expect(mockOnClose).not.toHaveBeenCalled();

            // 2. The author fills in the template; the stale refusal clears.
            fireEvent.change(screen.getByPlaceholderText('The ___ is the largest organ in the body.'), {
                target: { value: 'The ___ is the powerhouse of the cell.' },
            });
            expect(screen.queryByText(refusal)).not.toBeInTheDocument();

            // 3. The blank answer input appeared with the marker, and the save now succeeds.
            fireEvent.change(screen.getByPlaceholderText('Answer for blank 1'), {
                target: { value: 'mitochondrion' },
            });
            await act(async () => {
                fireEvent.click(saveButton);
            });

            expect(mockOnSave).toHaveBeenLastCalledWith(
                {
                    prompt: 'Fill in the blank.',
                    payload: {
                        type: 'fill_in_blank',
                        template: 'The ___ is the powerhouse of the cell.',
                        blanks: ['mitochondrion'],
                    },
                    difficulty: 'medium',
                    points: 1,
                    explanation: undefined,
                    tags: undefined,
                },
                'q-legacy-cloze',
            );
            expect(mockShowToast).toHaveBeenCalledWith('Question updated', { intent: 'success' });
            expect(mockOnClose).toHaveBeenCalled();
        });
    });
});
