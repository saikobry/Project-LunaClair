import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlashcardTab } from '../FlashcardTab';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { ToastProvider } from '../../../app/providers/ToastContext';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { flashcardQueryKeys } from '../queries/flashcardQueryKeys';

describe('FlashcardTab', () => {
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
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        // The filter reports deck slices in CARDS, not questions.
        expect(screen.getByRole('option', { name: 'All Quizzes (2 cards)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Practice Quiz (2 cards)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Master Quiz (2 cards)' })).toBeInTheDocument();

        // 1. Select quiz-1 (q-1 order 1, q-2 order 2).
        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-1' } });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // First card must be q-1 (order 1), not q-2
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
        expect(screen.queryByText('Plant cells have cell walls.')).not.toBeInTheDocument();
        expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();

        // Advance to second card: flip and rate Good
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => {
            expect(screen.getByText('Good')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Good'));

        // Second card must be q-2 (order 2)
        await waitFor(() => {
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument();
        });
        expect(screen.queryByText('What organelle produces ATP?')).not.toBeInTheDocument();
        expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();

        // Exit session back to setup
        fireEvent.click(screen.getByRole('button', { name: 'Exit session' }));
        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        // Reset review cache so both cards remain unreviewed (new) cards,
        // preventing orderDeck's dueAt bucketing from dominating incoming quiz item order.
        queryClient.setQueryData(flashcardQueryKeys.reviews('mat-1'), {});

        // 2. Select quiz-2 (q-2 order 1, q-1 order 2).
        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-2' } });
        fireEvent.click(screen.getByText('Start Flashcard Session'));

        // First card must flip to q-2 (order 1), not q-1
        await waitFor(() => {
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument();
        });
        expect(screen.queryByText('What organelle produces ATP?')).not.toBeInTheDocument();
        expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();

        // Advance to second card: flip and rate Good
        fireEvent.click(screen.getByLabelText('Show answer'));
        await waitFor(() => {
            expect(screen.getByText('Good')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Good'));

        // Second card must be q-1 (order 2)
        await waitFor(() => {
            expect(screen.getByText('What organelle produces ATP?')).toBeInTheDocument();
        });
        expect(screen.queryByText('Plant cells have cell walls.')).not.toBeInTheDocument();
        expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
    });

    it('flips card on click and records rating on rating button click', async () => {
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

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

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });
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
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });
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

    it('owns no authoring: the populated deck offers only a quiet route to the Question Bank', async () => {
        const onOpenQuestionBank = vi.fn();
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={onOpenQuestionBank} />, { wrapper: createWrapper() });

        await waitFor(() => {
            expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        });

        // No generator, no dialog, no "Generate with AI" — the retired card-authoring front
        // door. Cards come from questions, and questions are authored in exactly one place.
        expect(screen.queryByText(/Generate.*with AI/i)).toBeNull();
        expect(screen.queryByText(/Generate Flashcards/i)).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();

        // What remains is a navigation, labelled for what it does. `ghost` keeps it from
        // competing with the primary Start action on a surface that is about studying.
        const addQuestions = screen.getByRole('button', { name: 'Add questions' });
        fireEvent.click(addQuestions);
        expect(onOpenQuestionBank).toHaveBeenCalledTimes(1);

        // Authoring is a route change, not a write: nothing on this screen persists.
        expect(mockRecordReview.execute).not.toHaveBeenCalled();
    });
});

/**
 * An empty deck is a resolved state with a named reason, not a dead primary
 * button. These cases pin the reference instant so every quoted string is a
 * literal, and pin the host clock so "nothing due" is reachable at all: with a
 * fresh deck the selector defaults to All Cards, so the only way to reach the
 * empty state is to narrow the deck yourself.
 */
describe('FlashcardTab — empty deck', () => {
    let queryClient: QueryClient;
    let mockRecordReview: { execute: ReturnType<typeof vi.fn> };
    let mockContext: any;

    /** One minute ago, six hours, and three days — all measured from the pinned now. */
    const MINUTE_MS = 60_000;
    const HOUR_MS = 3_600_000;
    const referenceNow = new Date('2026-09-27T12:00:00.000Z');
    const dueOneMinuteAgo = new Date(referenceNow.getTime() - MINUTE_MS).toISOString();
    const dueInSixHours = new Date(referenceNow.getTime() + 6 * HOUR_MS).toISOString();
    const dueInThreeDays = new Date(referenceNow.getTime() + 3 * 24 * HOUR_MS).toISOString();

    const mockMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Biology',
        documentId: 'doc-1',
        createdAt: '2026-09-02T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
    };

    /** q-1 is in the practice quiz; q-2 is in the later quiz. Both are live. */
    const mockQuestions: Question[] = [
        {
            id: 'q-1',
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
        {
            id: 'q-2',
            materialId: 'mat-1',
            type: 'identification',
            prompt: 'What organelle produces ATP?',
            payload: { type: 'identification', correctAnswer: 'Mitochondria' },
            difficulty: 'easy',
            points: 1,
            status: 'published',
            version: 1,
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        },
    ];

    function makeQuiz(id: string, title: string, questionIds: string[]): Quiz {
        return {
            id,
            materialId: 'mat-1',
            title,
            questionIds,
            items: questionIds.map((questionId, index) => ({
                quizId: id,
                questionId,
                questionVersion: 1,
                order: index + 1,
            })),
            status: 'published',
            createdAt: '2026-09-02T10:00:00.000Z',
            updatedAt: '2026-09-02T10:00:00.000Z',
        };
    }

    const practiceQuiz = makeQuiz('quiz-1', 'Practice Quiz', ['q-1']);
    const laterQuiz = makeQuiz('quiz-2', 'Later Quiz', ['q-2']);
    /**
     * Its only question is not among the live questions — the shape an
     * all-archived quiz leaves behind, which is how a filter can select nothing.
     */
    const archivedOnlyQuiz = makeQuiz('quiz-3', 'Archived Only Quiz', ['q-archived']);

    const createWrapper = () => ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ApplicationContext.Provider value={mockContext}>
                <ToastProvider>{children}</ToastProvider>
            </ApplicationContext.Provider>
        </QueryClientProvider>
    );

    function reviewFor(key: string, dueAt: string) {
        return {
            key,
            materialId: 'mat-1',
            repetitions: 1,
            easeFactor: 2.5,
            intervalDays: 1,
            dueAt,
            lapses: 0,
            reviewCount: 1,
        };
    }

    beforeEach(() => {
        // shouldAdvanceTime keeps TanStack Query's own timers running, so the
        // component still settles on a pinned clock.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(referenceNow);

        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockRecordReview = { execute: vi.fn().mockResolvedValue(undefined) };
        mockContext = {
            repositories: {
                question: { getQuestions: vi.fn().mockResolvedValue(mockQuestions) },
                quiz: {
                    getQuizzes: vi
                        .fn()
                        .mockResolvedValue([practiceQuiz, laterQuiz, archivedOnlyQuiz]),
                },
                flashcardReview: { getByMaterial: vi.fn().mockResolvedValue([]) },
                library: { getMaterial: vi.fn().mockResolvedValue(mockMaterial) },
                document: { getDocument: vi.fn().mockResolvedValue({ content: '# Notes' }) },
            },
            useCases: {
                flashcards: { recordReview: mockRecordReview },
                package: { exportStudyPackage: { execute: vi.fn() } },
            },
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('disables Start and names the real next due time when nothing is due', async () => {
        mockContext.repositories.flashcardReview.getByMaterial.mockResolvedValue([
            reviewFor('q:q-1', dueInSixHours),
            reviewFor('q:q-2', dueInThreeDays),
        ]);

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());

        // Every card is scheduled forward, so the selector defaulted to All Cards
        // and the deck is studyable. Only the deliberate switch to Due Cards Only
        // empties it — which is exactly the path that used to dead-end silently.
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();
        expect(screen.queryByText(/^Nothing due right now/)).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Due Cards Only/ }));

        expect(
            screen.getByText('Nothing due right now — the next card is due in 6 hours.')
        ).toBeInTheDocument();

        const startButton = screen.getByRole('button', { name: 'Start Flashcard Session' });
        expect(startButton).toBeDisabled();
        // The reason travels with the control rather than floating free of it.
        expect(startButton).toHaveAttribute('aria-describedby', 'flashcard-deck-blocked-reason');
        expect(document.getElementById('flashcard-deck-blocked-reason')).toHaveTextContent(
            'Nothing due right now — the next card is due in 6 hours.'
        );
    });

    it('does not style "nothing due" as a failure', async () => {
        mockContext.repositories.flashcardReview.getByMaterial.mockResolvedValue([
            reviewFor('q:q-1', dueInSixHours),
            reviewFor('q:q-2', dueInThreeDays),
        ]);

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Due Cards Only/ }));

        // Nothing due is the scheduler working, so the note is a status line in
        // the secondary text role — no error token, no failure styling, and not
        // announced as an alert.
        const reason = document.getElementById('flashcard-deck-blocked-reason')!;
        expect(reason.className).toContain('"color":"var(--color-text-secondary)"');
        expect(reason.className).not.toMatch(/error|danger|warning/i);
        expect(reason).not.toHaveAttribute('role', 'alert');
    });

    it('disables Start and names the selection when the quiz filter holds no cards', async () => {
        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());

        // The filter control only renders with more than one active quiz, so
        // drive the real control rather than assuming it exists.
        expect(screen.getByLabelText('Quiz Filter')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Quiz Filter'), {
            target: { value: 'quiz-3' },
        });

        expect(
            screen.getByText(
                'Archived Only Quiz has no flashcards to study. Change the Quiz Filter, or select All Quizzes, to start a session.'
            )
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeDisabled();

        // And the other way round: a quiz that does have cards re-enables it.
        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-1' } });
        expect(screen.queryByText(/has no flashcards to study/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();
    });

    it('re-derives the reason and the disabled state when the study mode changes', async () => {
        mockContext.repositories.flashcardReview.getByMaterial.mockResolvedValue([
            reviewFor('q:q-1', dueInSixHours),
            // q-2 came due a minute ago, so the due-only deck is not empty.
            reviewFor('q:q-2', dueOneMinuteAgo),
        ]);

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());

        // One card is due, so the deck defaulted to Due Cards Only and Start is live.
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();
        expect(screen.queryByText(/^Nothing due right now/)).toBeNull();

        // Narrow the filter to the quiz whose only card is due in six hours: the
        // reason changes with the selection, and the quoted date is that card's.
        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-1' } });
        expect(
            screen.getByText('Nothing due right now — the next card is due in 6 hours.')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeDisabled();

        // Back to a mode that has cards: Start must not stay disabled.
        fireEvent.click(screen.getByRole('button', { name: /All Cards/ }));
        expect(screen.queryByText(/^Nothing due right now/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();

        // The re-enabled deck really does start, and it starts with the card the
        // filter scopes to.
        fireEvent.click(screen.getByRole('button', { name: 'Start Flashcard Session' }));
        await waitFor(() =>
            expect(screen.getByText('Plant cells have cell walls.')).toBeInTheDocument()
        );
    });

    it('quotes the next due time from the filtered pool, not the whole material', async () => {
        mockContext.repositories.flashcardReview.getByMaterial.mockResolvedValue([
            // Due first of all, but it lives in the practice quiz...
            reviewFor('q:q-1', dueInSixHours),
            // ...so the sooner card is the one the filter excludes.
            reviewFor('q:q-2', dueInThreeDays),
        ]);

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());

        // Nothing is due at all, so the selector defaulted to All Cards and the
        // whole deck is studyable.
        expect(screen.getByRole('button', { name: 'Start Flashcard Session' })).toBeEnabled();

        // The deliberate switch to Due Cards Only, in whole-material scope, quotes
        // the soonest card in the material.
        fireEvent.click(screen.getByRole('button', { name: /Due Cards Only/ }));
        expect(
            screen.getByText('Nothing due right now — the next card is due in 6 hours.')
        ).toBeInTheDocument();

        // Narrow the filter away from that card: the quote must follow the scope
        // to the card the user can actually see, never the excluded sooner one.
        fireEvent.change(screen.getByLabelText('Quiz Filter'), { target: { value: 'quiz-2' } });
        expect(
            screen.getByText('Nothing due right now — the next card is due in 3 days.')
        ).toBeInTheDocument();
        expect(screen.queryByText(/in 6 hours/)).toBeNull();
    });

    it('keeps the screen on the setup view if a click somehow lands while Start is disabled', async () => {
        mockContext.repositories.flashcardReview.getByMaterial.mockResolvedValue([
            reviewFor('q:q-1', dueInSixHours),
            reviewFor('q:q-2', dueInThreeDays),
        ]);

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={vi.fn()} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: /Due Cards Only/ }));

        const startButton = screen.getByRole('button', { name: 'Start Flashcard Session' });
        expect(startButton).toBeDisabled();

        // Simulate the protection that must NOT be the user-facing behaviour: the
        // selection or the schedule moved under the button between render and
        // click, so a click lands anyway. Strip the attribute the way a stale
        // render would and click through it — `orderDeck` returning nothing has to
        // hold the screen on the setup view rather than start nothing.
        startButton.removeAttribute('disabled');
        fireEvent.click(startButton);

        expect(screen.queryByText('Plant cells have cell walls.')).toBeNull();
        expect(screen.queryByText('What organelle produces ATP?')).toBeNull();
        expect(screen.queryByText(/Session Complete/i)).toBeNull();
        expect(screen.getByText('Start Flashcard Session')).toBeInTheDocument();
        expect(mockRecordReview.execute).not.toHaveBeenCalled();
    });

    it('makes authoring the primary action when the bank is empty, and hands off with a return path', async () => {
        // Zero questions is a different state from "nothing due": there is no content at all,
        // so the honest action is to create some. It is primary here precisely because it is
        // the only thing this surface can usefully offer.
        mockContext.repositories.question.getQuestions.mockResolvedValue([]);
        const onOpenQuestionBank = vi.fn();

        render(<FlashcardTab materialId="mat-1" onOpenQuestionBank={onOpenQuestionBank} />, { wrapper: createWrapper() });

        await waitFor(() => expect(screen.getByText('No Flashcards Available')).toBeInTheDocument());

        // The copy names the real relationship: cards are built FROM the Question Bank.
        expect(screen.getByText(/Cards are built from your Question Bank/i)).toBeInTheDocument();
        // And it no longer promises generation from this tab, because that path is gone.
        expect(screen.queryByText(/Generate cards directly from your notes/i)).toBeNull();
        expect(screen.queryByText(/Generate.*with AI/i)).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Generate questions' }));
        // The workspace answers this by arming the one-shot launch intent (Fill in the Blank
        // preselected, plus a "Study these questions" way back to this tab) *and* routing to
        // `?tab=questions`. What this feature contributes is the handoff and nothing else.
        expect(onOpenQuestionBank).toHaveBeenCalledTimes(1);
        expect(mockRecordReview.execute).not.toHaveBeenCalled();
    });
});
