import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlashcardScreen } from '../FlashcardScreen';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../app/providers/ToastContext';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

describe('FlashcardScreen', () => {
    let queryClient: QueryClient;
    let mockRecordReview: { execute: ReturnType<typeof vi.fn> };
    let mockContext: any;

    const mockMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Biology',
        documentId: 'doc-1',
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    const mockQuestions: Question[] = [
        {
            id: 'q-1',
            materialId: 'mat-1',
            type: 'multiple_choice',
            prompt: 'What organelle produces ATP?',
            payload: { type: 'multiple_choice', choices: ['Mitochondria', 'Nucleus'], correctIndex: 0 },
            difficulty: 'easy',
            points: 1,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
        {
            id: 'q-2',
            materialId: 'mat-1',
            type: 'true_false',
            prompt: 'Plant cells have cell walls.',
            payload: { type: 'true_false', correctAnswer: true },
            difficulty: 'medium',
            points: 1,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockRecordReview = {
            execute: vi.fn().mockResolvedValue({
                key: 'q-1:card',
                materialId: 'mat-1',
                repetitions: 1,
                easeFactor: 2.5,
                intervalDays: 1,
                dueAt: '2026-09-03T10:00:00.000Z',
                lastReviewedAt: '2026-09-02T10:00:00.000Z',
                lapses: 0,
                reviewCount: 1,
            }),
        };

        mockContext = {
            repositories: {
                question: {
                    getQuestions: vi.fn().mockResolvedValue(mockQuestions),
                },
                quiz: {
                    getQuizzes: vi.fn().mockResolvedValue([]),
                },
                flashcardReview: {
                    getByMaterial: vi.fn().mockResolvedValue([]),
                },
                library: {
                    getMaterial: vi.fn().mockResolvedValue(mockMaterial),
                },
                document: {
                    getDocument: vi.fn().mockResolvedValue({ content: '# Notes' }),
                },
            },
            useCases: {
                flashcards: {
                    recordReview: mockRecordReview,
                },
                package: {
                    exportStudyPackage: { execute: vi.fn() },
                },
            },
        };
    });

    const createWrapper = () => ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ApplicationContext.Provider value={mockContext}>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </ApplicationContext.Provider>
        </QueryClientProvider>
    );

    it('renders deck setup view and transitions to active session on start', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        // Wait for setup view to load
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        // Click Start Flashcard Session button
        const startBtn = screen.getByText('Start Flashcard Session');
        fireEvent.click(startBtn);

        // Player view should now be rendered with the first card prompt
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
    });

    it('orders selected quiz cards by the quiz item order', async () => {
        const practiceQuiz: Quiz = {
            id: 'quiz-1',
            materialId: 'mat-1',
            title: 'Practice Quiz',
            questionIds: ['q-1', 'q-2'],
            items: [
                { quizId: 'quiz-1', questionId: 'q-1', questionVersion: 1, order: 1 },
                { quizId: 'quiz-1', questionId: 'q-2', questionVersion: 1, order: 2 },
            ],
            status: 'published',
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };
        const masterQuiz: Quiz = {
            ...practiceQuiz,
            id: 'quiz-2',
            title: 'Master Quiz',
            questionIds: ['q-2', 'q-1'],
            items: [
                { quizId: 'quiz-2', questionId: 'q-2', questionVersion: 1, order: 1 },
                { quizId: 'quiz-2', questionId: 'q-1', questionVersion: 1, order: 2 },
            ],
        };
        mockContext.repositories.question.getQuestions.mockResolvedValue([mockQuestions[1], mockQuestions[0]]);
        mockContext.repositories.quiz.getQuizzes.mockResolvedValue([practiceQuiz, masterQuiz]);

        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-1' } });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
    });

    it('flips card on click and records rating on rating button click', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Start Flashcard Session'));

        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });

        // Card is not flipped initially; click to flip
        const cardFace = screen.getByLabelText('Show answer');
        fireEvent.click(cardFace);

        // Rating buttons become visible
        await waitFor(() => {
            expect(screen.getByText('Good')).toBeInTheDocument();
        });

        // Click Good rating (3)
        const goodBtn = screen.getByText('Good');
        fireEvent.click(goodBtn);

        // Should have called recordReview with 'good'
        await waitFor(() => {
            expect(mockRecordReview.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    rating: 'good',
                    materialId: 'mat-1',
                }),
            );
        });

        // Card 2 prompt should now be rendered
        await waitFor(() => {
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument();
        });
    });

    it('shows a choice card’s options ungraded and marks the correct one after the flip', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // q-1 is a multiple_choice question, so its card is a choice card: the
        // options belong to the question and are shown on the front face.
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
        // Both flip faces stay mounted (the flip is a 3D transform with
        // backface-visibility), so each option text appears once per face.
        expect(screen.getAllByText('Mitochondria')).toHaveLength(2);
        expect(screen.getAllByText('Nucleus')).toHaveLength(2);

        // The grading mark is bound to the back-face row alone — of the two
        // "Mitochondria" rows only the back face is labelled, so the front face
        // can never leak which option is right.
        expect(screen.getAllByLabelText('Mitochondria — correct answer')).toHaveLength(1);
        expect(screen.queryByLabelText('Nucleus — correct answer')).toBeNull();

        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => {
            expect(screen.getByText('Good')).toBeInTheDocument();
        });

        // Still exactly one graded row: the reveal does not add a marker, it
        // reveals the back face that already carries it.
        expect(screen.getAllByLabelText('Mitochondria — correct answer')).toHaveLength(1);
    });

    it('labels a recall card’s difficulty as the source question’s, with no card-shape badge', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // q-1 is the choice card; rating through it reveals q-2, a true_false
        // card whose shape badge would have been pure noise.
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Easy')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Easy'));

        await waitFor(() => {
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument();
        });
        expect(screen.getByText('Source difficulty: medium')).toBeInTheDocument();
        expect(screen.queryByText('MULTIPLE ANSWER')).toBeNull();
    });

    it('completes the deck and shows session summary when all cards are reviewed', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // Review card 1
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Easy')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Easy'));

        // Review card 2
        await waitFor(() => {
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Again')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Again'));

        // Deck finished -> Summary view rendered
        await waitFor(() => {
            expect(screen.getByText(/Session Complete/i)).toBeInTheDocument();
        });
    });
});
