import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizCatalogTab } from '../QuizCatalogTab';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';

const mockShowToast = vi.fn();
vi.mock('../../../../app/providers/ToastContext', () => ({
    useToast: () => ({ showToast: mockShowToast }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('QuizCatalogTab', () => {
    let mockOnNavigate: ReturnType<typeof vi.fn>;
    let mockOnPublish: ReturnType<typeof vi.fn>;
    let mockOnArchive: ReturnType<typeof vi.fn>;
    let mockOnUnarchive: ReturnType<typeof vi.fn>;

    const mockQuizzes: Quiz[] = [
        {
            id: 'quiz-1',
            materialId: 'mat-1',
            title: 'Cell Structure Quiz',
            description: 'Covers organelles and membranes',
            status: 'published',
            passingPercentage: 75,
            questionIds: ['q-1', 'q-2'],
            items: [],
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'quiz-2',
            materialId: 'mat-1',
            title: 'Draft Quiz',
            description: 'Draft description',
            status: 'draft',
            passingPercentage: 60,
            questionIds: ['q-3'],
            items: [],
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'quiz-3',
            materialId: 'mat-1',
            title: 'Archived Quiz',
            description: '',
            status: 'archived',
            passingPercentage: 80,
            questionIds: [],
            items: [],
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnNavigate = vi.fn();
        mockOnPublish = vi.fn();
        mockOnArchive = vi.fn();
        mockOnUnarchive = vi.fn();
    });

    const renderTab = (props: Partial<Parameters<typeof QuizCatalogTab>[0]> = {}) => {
        return render(
            <QuizCatalogTab
                quizzes={mockQuizzes}
                materialId="mat-1"
                onNavigate={mockOnNavigate as any}
                onPublish={mockOnPublish as any}
                onArchive={mockOnArchive as any}
                onUnarchive={mockOnUnarchive as any}
                {...props}
            />,
        );
    };

    it('renders active quizzes and hides archived quizzes by default', () => {
        renderTab();

        expect(screen.getByText('Cell Structure Quiz')).toBeInTheDocument();
        expect(screen.getByText('Draft Quiz')).toBeInTheDocument();
        expect(screen.queryByText('Archived Quiz')).not.toBeInTheDocument();
        expect(screen.getByText('1 archived')).toBeInTheDocument();
    });

    it('toggles archived quiz visibility', () => {
        renderTab();

        const showArchivedBtn = screen.getByRole('button', { name: /Show archived quizzes/i });
        fireEvent.click(showArchivedBtn);

        expect(screen.getByText('Archived Quiz')).toBeInTheDocument();
        expect(screen.getByText('Showing archived')).toBeInTheDocument();

        const hideArchivedBtn = screen.getByRole('button', { name: /Hide archived quizzes/i });
        fireEvent.click(hideArchivedBtn);

        expect(screen.queryByText('Archived Quiz')).not.toBeInTheDocument();
    });

    it('navigates to quiz canvas on Create Quiz button click', () => {
        renderTab();

        const createQuizBtn = screen.getByRole('button', { name: 'Create quiz' });
        fireEvent.click(createQuizBtn);

        expect(mockOnNavigate).toHaveBeenCalledWith({
            kind: 'quiz-canvas',
            materialId: 'mat-1',
        });
    });

    it('navigates to quiz canvas with quizId on Edit quiz button click', () => {
        renderTab();

        const editQuizBtn = screen.getByRole('button', { name: /Edit quiz: Cell Structure Quiz/i });
        fireEvent.click(editQuizBtn);

        expect(mockOnNavigate).toHaveBeenCalledWith({
            kind: 'quiz-canvas',
            materialId: 'mat-1',
            quizId: 'quiz-1',
        });
    });

    it('publishes draft quiz on publish button click', () => {
        renderTab();

        const publishBtn = screen.getByRole('button', { name: /Publish quiz: Draft Quiz/i });
        fireEvent.click(publishBtn);

        expect(mockOnPublish).toHaveBeenCalledWith('quiz-2');
        expect(mockShowToast).toHaveBeenCalledWith('Quiz published to catalog', { intent: 'success' });
    });

    it('opens confirmation dialog and archives quiz on confirm', () => {
        renderTab();

        const archiveBtn = screen.getByRole('button', { name: /Archive quiz: Cell Structure Quiz/i });
        fireEvent.click(archiveBtn);

        expect(screen.getByRole('heading', { name: 'Archive Quiz' })).toBeInTheDocument();
        expect(mockOnArchive).not.toHaveBeenCalled();

        const confirmBtn = screen.getByRole('button', { name: 'Archive Quiz' });
        fireEvent.click(confirmBtn);

        expect(mockOnArchive).toHaveBeenCalledWith('quiz-1');
        expect(mockShowToast).toHaveBeenCalledWith('Quiz archived', { intent: 'info' });
    });

    it('restores archived quiz on unarchive button click', () => {
        renderTab();

        // Show archived
        fireEvent.click(screen.getByRole('button', { name: /Show archived quizzes/i }));

        const restoreBtn = screen.getByRole('button', { name: /Restore quiz: Archived Quiz/i });
        fireEvent.click(restoreBtn);

        expect(mockOnUnarchive).toHaveBeenCalledWith('quiz-3');
        expect(mockShowToast).toHaveBeenCalledWith('Quiz restored to draft', { intent: 'success' });
    });

    it('renders empty state when no quizzes exist in material', () => {
        renderTab({ quizzes: [] });

        expect(screen.getByText('Start building your quiz catalog')).toBeInTheDocument();
        const createFirstBtn = screen.getByRole('button', { name: /Create first quiz/i });
        fireEvent.click(createFirstBtn);

        expect(mockOnNavigate).toHaveBeenCalledWith({
            kind: 'quiz-canvas',
            materialId: 'mat-1',
        });
    });

    it('renders all-quizzes-archived empty state when all quizzes are archived and filter is hidden', () => {
        const archivedOnly: Quiz[] = [
            {
                ...mockQuizzes[2],
            },
        ];

        renderTab({ quizzes: archivedOnly });

        expect(screen.getByText('All quizzes are archived')).toBeInTheDocument();
    });
});
