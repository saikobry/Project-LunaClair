import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionBankTab } from '../QuestionBankTab';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

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

vi.mock('../../../../shared/hooks/useDebounce', () => ({
    useDebounce: (v: any) => v,
}));

describe('QuestionBankTab', () => {
    let mockOnCreate: ReturnType<typeof vi.fn>;
    let mockOnUpdate: ReturnType<typeof vi.fn>;
    let mockOnPublish: ReturnType<typeof vi.fn>;
    let mockOnArchive: ReturnType<typeof vi.fn>;
    let mockOnUnarchive: ReturnType<typeof vi.fn>;

    const mockQuestions: Question[] = [
        {
            id: 'q-1',
            materialId: 'mat-1',
            type: 'multiple_choice',
            prompt: 'What organelle produces energy?',
            payload: { type: 'multiple_choice', choices: ['Mitochondria', 'Nucleus'], correctIndex: 0 },
            difficulty: 'easy',
            points: 1,
            explanation: 'Mitochondria produces ATP.',
            tags: ['biology', 'cell'],
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-2',
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Is water a polar molecule?',
            payload: { type: 'true_false', correctAnswer: true },
            difficulty: 'medium',
            points: 2,
            tags: ['chemistry'],
            status: 'draft',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-3',
            materialId: 'mat-1',
            type: 'identification',
            prompt: 'Identify Newton first law concept',
            payload: { type: 'identification', correctAnswer: 'Inertia', acceptedAlternatives: [] },
            difficulty: 'hard',
            points: 3,
            tags: ['physics'],
            status: 'archived',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    const mockQuizzes: Quiz[] = [
        {
            id: 'quiz-1',
            materialId: 'mat-1',
            title: 'Cell Biology Quiz',
            description: '',
            status: 'published',
            passingPercentage: 70,
            questionIds: ['q-1'],
            items: [],
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnCreate = vi.fn();
        mockOnUpdate = vi.fn();
        mockOnPublish = vi.fn();
        mockOnArchive = vi.fn();
        mockOnUnarchive = vi.fn();
    });

    const renderTab = (props: Partial<Parameters<typeof QuestionBankTab>[0]> = {}) => {
        return render(
            <QuestionBankTab
                questions={mockQuestions}
                quizzes={mockQuizzes}
                materialId="mat-1"
                onCreate={mockOnCreate as any}
                onUpdate={mockOnUpdate as any}
                onPublish={mockOnPublish as any}
                onArchive={mockOnArchive as any}
                onUnarchive={mockOnUnarchive as any}
                {...props}
            />,
        );
    };

    it('renders list of questions and their quiz usage badges', () => {
        renderTab();

        expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
        expect(screen.getByText('Is water a polar molecule?')).toBeInTheDocument();
        expect(screen.getByText('Identify Newton first law concept')).toBeInTheDocument();

        // q-1 is in mockQuizzes -> Used in 1 quiz
        expect(screen.getByText('Used in 1 quiz')).toBeInTheDocument();
        // q-2 is not in any quiz -> Not used in any quiz
        expect(screen.getAllByText('Not used in any quiz')).toHaveLength(2);
    });

    it('filters questions by search query (prompt and tag matching)', () => {
        renderTab();

        const searchInput = screen.getByPlaceholderText('Search prompts and tags…');

        // Search for 'water'
        fireEvent.change(searchInput, { target: { value: 'water' } });
        expect(screen.getByText('Is water a polar molecule?')).toBeInTheDocument();
        expect(screen.queryByText('What organelle produces energy?')).not.toBeInTheDocument();

        // Search by tag with leading #
        fireEvent.change(searchInput, { target: { value: '#biology' } });
        expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
        expect(screen.queryByText('Is water a polar molecule?')).not.toBeInTheDocument();
    });

    it('filters questions by type, difficulty, and status selectors', () => {
        renderTab();

        const typeSelector = screen.getByLabelText('Filter by type');
        fireEvent.change(typeSelector, { target: { value: 'true_false' } });

        expect(screen.getByText('Is water a polar molecule?')).toBeInTheDocument();
        expect(screen.queryByText('What organelle produces energy?')).not.toBeInTheDocument();
        expect(screen.queryByText('Identify Newton first law concept')).not.toBeInTheDocument();
    });

    it('toggles tag filter on chip click', () => {
        renderTab();

        const biologyTagChip = screen.getByText('#biology');
        fireEvent.click(biologyTagChip);

        expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
        expect(screen.queryByText('Is water a polar molecule?')).not.toBeInTheDocument();

        // Click again to toggle off
        fireEvent.click(biologyTagChip);
        expect(screen.getByText('Is water a polar molecule?')).toBeInTheDocument();
    });

    it('renders empty state when question bank is completely empty', () => {
        renderTab({ questions: [] });

        expect(screen.getByText('Start building your question bank')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create First Question/i })).toBeInTheDocument();
    });

    it('renders empty state when search/filter matches no questions and provides clear filters action', () => {
        renderTab();

        const searchInput = screen.getByPlaceholderText('Search prompts and tags…');
        fireEvent.change(searchInput, { target: { value: 'nonexistent query XYZ' } });

        expect(screen.getByText('No questions found')).toBeInTheDocument();

        const clearButton = screen.getByRole('button', { name: /Clear filters/i });
        fireEvent.click(clearButton);

        expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
    });

    it('publishes draft question on publish button click', () => {
        renderTab();

        const publishButton = screen.getByRole('button', { name: /Publish question: Is water a polar molecule\?/i });
        fireEvent.click(publishButton);

        expect(mockOnPublish).toHaveBeenCalledWith('q-2');
        expect(mockShowToast).toHaveBeenCalledWith('Question published', { intent: 'success' });
    });

    it('archives unused question directly without confirmation dialog', () => {
        renderTab();

        // q-2 is unused
        const archiveButton = screen.getByRole('button', { name: /Archive question: Is water a polar molecule\?/i });
        fireEvent.click(archiveButton);

        expect(mockOnArchive).toHaveBeenCalledWith('q-2');
        expect(mockShowToast).toHaveBeenCalledWith('Question moved to archive', { intent: 'info' });
    });

    it('opens confirmation dialog when attempting to archive a question used in quizzes', () => {
        renderTab();

        // q-1 is used in 1 quiz
        const archiveButton = screen.getByRole('button', { name: /Archive question: What organelle produces energy\?/i });
        fireEvent.click(archiveButton);

        expect(screen.getByText('Archive question?')).toBeInTheDocument();
        expect(mockOnArchive).not.toHaveBeenCalled();

        const confirmButton = screen.getByRole('button', { name: 'Archive' });
        fireEvent.click(confirmButton);

        expect(mockOnArchive).toHaveBeenCalledWith('q-1');
        expect(mockShowToast).toHaveBeenCalledWith('Question moved to archive', { intent: 'info' });
    });

    it('restores archived question on unarchive button click', () => {
        renderTab();

        // q-3 is archived
        const restoreButton = screen.getByRole('button', { name: /Restore question: Identify Newton first law concept/i });
        fireEvent.click(restoreButton);

        expect(mockOnUnarchive).toHaveBeenCalledWith('q-3');
        expect(mockShowToast).toHaveBeenCalledWith('Question restored to draft', { intent: 'success' });
    });
});
