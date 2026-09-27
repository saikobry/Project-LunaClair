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

    /** Three blanks, so the projection must expand it into three cards. */
    const mockClozeQuestion: Question = {
        id: 'q-3',
        materialId: 'mat-1',
        type: 'fill_in_blank',
        prompt: 'Fill in the blank:',
        payload: {
            type: 'fill_in_blank',
            template: 'The ___ contains the ___ and the ___.',
            blanks: ['nucleus', 'chromatin', 'DNA'],
        },
        difficulty: 'medium',
        points: 1,
        status: 'published',
        version: 1,
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

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

        // The filter reports deck slices in CARDS, not questions.
        expect(screen.getByRole('option', { name: 'All Quizzes (2 cards)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Practice Quiz (2 cards)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Master Quiz (2 cards)' })).toBeInTheDocument();

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

    it('counts projected cards, not questions, on the deck setup view', async () => {
        // One question, three blanks: if the setup view still counted questions
        // it would promise 1 card and the "Due Cards Only" session would show 3.
        mockContext.repositories.question.getQuestions.mockResolvedValue([mockClozeQuestion]);

        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        expect(screen.getByText('3 Total in Bank')).toBeInTheDocument();
        expect(screen.getByText('3 New')).toBeInTheDocument();
        expect(screen.getByText('3 Cards Due Today')).toBeInTheDocument();
        expect(
            screen.getByText('Focus on 3 cards due for scheduled review today')
        ).toBeInTheDocument();
        expect(
            screen.getByText('Review entire deck (3 cards; due cards first)')
        ).toBeInTheDocument();
    });

    it('expands a multi-blank question into one independently rated card per blank', async () => {
        mockContext.repositories.question.getQuestions.mockResolvedValue([mockClozeQuestion]);

        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // Card 1 — blank #0 hidden, the other two answers visible as scaffolding.
        await waitFor(() => {
            expect(screen.getByText('The ___ contains the chromatin and the DNA.')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Good')).toBeInTheDocument());
        // The back is the one answer under test, never the joined list.
        expect(screen.getByText('nucleus')).toBeInTheDocument();
        expect(screen.queryByText('nucleus, chromatin, DNA')).toBeNull();
        fireEvent.click(screen.getByText('Good'));

        // Card 2 — blank #1 hidden, blank #0's answer now visible.
        await waitFor(() => {
            expect(screen.getByText('The nucleus contains the ___ and the DNA.')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Good')).toBeInTheDocument());
        expect(screen.getByText('chromatin')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Good'));

        // Card 3 — blank #2 hidden.
        await waitFor(() => {
            expect(screen.getByText('The nucleus contains the chromatin and the ___.')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => expect(screen.getByText('Good')).toBeInTheDocument());
        expect(screen.getByText('DNA')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Good'));

        // All three cards were rated under three distinct persisted keys.
        await waitFor(() => {
            expect(screen.getByText(/Session Complete/i)).toBeInTheDocument();
        });
        expect(mockRecordReview.execute).toHaveBeenCalledTimes(3);
        for (const [index, key] of ['q:q-3#0', 'q:q-3#1', 'q:q-3#2'].entries()) {
            expect(mockRecordReview.execute).toHaveBeenNthCalledWith(
                index + 1,
                expect.objectContaining({ key })
            );
        }
    });

    it('bounds each face in a keyboard-focusable scroll region and keeps the rating bar reachable', async () => {
        render(<FlashcardScreen materialId="mat-1" />, { wrapper: createWrapper() });
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });

        // Each face's content scroll region is the flip control and the keyboard
        // entry point for that face. While front-facing only the front region is
        // in the tab order; the (backface-hidden) back region is demoted so
        // keyboard users never land on the answer before flipping.
        const frontRegion = screen.getByRole('button', { name: 'Show answer' });
        expect(frontRegion).toHaveAttribute('tabindex', '0');
        frontRegion.focus();
        expect(frontRegion).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Show question' })).toHaveAttribute(
            'tabindex',
            '-1'
        );

        fireEvent.click(frontRegion);
        await waitFor(() => expect(screen.getByText('Good')).toBeInTheDocument());

        // The flip swaps the tab order: only the now-visible answer face is
        // keyboard-reachable, and its content scrolls independently of the
        // rating bar, which stays outside the scroll region and fully usable.
        expect(screen.getByRole('button', { name: 'Show answer' })).toHaveAttribute(
            'tabindex',
            '-1'
        );
        const answerRegion = screen.getByRole('button', { name: 'Show question' });
        expect(answerRegion).toHaveAttribute('tabindex', '0');
        answerRegion.focus();
        expect(answerRegion).toHaveFocus();

        // The rating bar lives OUTSIDE the scroll region, so answer overflow
        // can never scroll the ratings out of view.
        const goodButton = screen.getByRole('button', { name: /Good/ });
        expect(answerRegion).not.toContainElement(goodButton);

        fireEvent.click(goodButton);
        await waitFor(() => {
            expect(mockRecordReview.execute).toHaveBeenCalledWith(
                expect.objectContaining({ rating: 'good' })
            );
        });
    });
});
