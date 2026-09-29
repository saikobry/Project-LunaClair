import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { QuestionBankTab } from '../QuestionBankTab';
import type {
    GeneratorLaunchChannel,
    GeneratorLaunchIntent,
} from '../../hooks/useGeneratorLaunchClaim';
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

// The generator dialog is not under test here — the launch handoff is. Stub it so the
// assertions are about *when* it opens and *with what*, not about its internals.
vi.mock('../../../ai/generator/components/AiQuestionGeneratorDialog', () => ({
    AiQuestionGeneratorDialog: (props: any) =>
        props.isOpen ? (
            <div role="dialog" aria-label="generator-stub">
                <span data-testid="initial-types">{JSON.stringify(props.initialTypes ?? null)}</span>
                <span data-testid="return-label">{props.returnAction?.label ?? ''}</span>
                <button onClick={props.onClose}>close</button>
                <button onClick={props.returnAction?.onReturn}>return</button>
            </div>
        ) : null,
}));

/** The owner's channel with nothing pending — the state a fresh page load (or deep link) starts in. */
const NO_LAUNCH: GeneratorLaunchChannel = { intent: null, onRetire: () => {} };

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
                generatorLaunch={NO_LAUNCH}
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

    /**
     * The launch handoff. A study surface (Flashcards) can arm a one-shot intent; the Bank
     * claims it, opens the ONE generator with the requested types, and offers a way back.
     * Nothing here authors: the dialog and the use case pair are unchanged.
     *
     * The intent now arrives as a **prop**, not through context: the workspace screen owns the
     * pending request and hands down the single command that retires it. These tests assert the
     * behaviour end to end, so the mechanism is free to change again without losing coverage.
     */
    describe('the launch handoff', () => {
        const fillInBlankLaunch: GeneratorLaunchIntent = {
            materialId: 'mat-1',
            requestedTypes: ['fill_in_blank'],
            returnTo: { tab: 'flashcards', label: 'Study these questions' },
        };
        const otherMaterialLaunch: GeneratorLaunchIntent = {
            ...fillInBlankLaunch,
            materialId: 'mat-2',
        };
        /** A SECOND launch for the SAME material — a supersession, not a mis-delivery. */
        const secondLaunch: GeneratorLaunchIntent = {
            materialId: 'mat-1',
            requestedTypes: ['true_false', 'identification'],
            returnTo: { tab: 'flashcards', label: 'Study these too' },
        };

        /**
         * The owner's channel, as the feature sees it: one pending request plus the single
         * command that retires it. Every retirement is recorded, so a test can tell an emptied
         * channel from a merely-closed dialog.
         */
        let retirements: ReturnType<typeof vi.fn<(intent: GeneratorLaunchIntent) => void>>;

        /** Stands in for the workspace screen: it owns the intent and retires it on command. */
        function LaunchOwner({ tabProps }: { tabProps?: Partial<Parameters<typeof QuestionBankTab>[0]> }) {
            const [intent, setIntent] = useState<GeneratorLaunchIntent | null>(null);
            // The channel's contract, mirrored exactly: retirement NAMES its target, and the
            // owner empties itself only when the target is still the intent it holds. That is
            // what lets a superseded dialog close without destroying a newer launch.
            const onRetire = (target: GeneratorLaunchIntent) => {
                retirements(target);
                setIntent((current) => (current === target ? null : current));
            };

            return (
                <>
                    {/* The owner's own view of its channel — how a test reads "emptied". */}
                    <span data-testid="owner-intent">
                        {intent ? `${intent.materialId}:${intent.returnTo.label}` : 'none'}
                    </span>
                    <button onClick={() => setIntent(fillInBlankLaunch)}>launch</button>
                    <button onClick={() => setIntent(otherMaterialLaunch)}>launch-other-material</button>
                    <button onClick={() => setIntent(secondLaunch)}>launch-again</button>
                    <QuestionBankTab
                        questions={mockQuestions}
                        quizzes={mockQuizzes}
                        materialId="mat-1"
                        onCreate={mockOnCreate as any}
                        onUpdate={mockOnUpdate as any}
                        onPublish={mockOnPublish as any}
                        onArchive={mockOnArchive as any}
                        onUnarchive={mockOnUnarchive as any}
                        generatorLaunch={{ intent, onRetire }}
                        {...tabProps}
                    />
                </>
            );
        }

        function renderWithOwner(tabProps: Partial<Parameters<typeof QuestionBankTab>[0]> = {}) {
            return render(<LaunchOwner tabProps={tabProps} />);
        }

        beforeEach(() => {
            retirements = vi.fn();
        });

        it('opens the generator with the requested types when a launch arrives', () => {
            renderWithOwner();

            // Nothing yet: no intent is pending, and a fresh load / deep link must not open a
            // dialog on its own.
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');
            expect(screen.queryByRole('dialog')).toBeNull();

            fireEvent.click(screen.getByText('launch'));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            // Fill in the Blank is preselected, because that is what a card generation asks for.
            expect(screen.getByTestId('initial-types')).toHaveTextContent('["fill_in_blank"]');
        });

        it('offers the launcher a way back, and returning hands back the launcher tab', () => {
            const onReturnToTab = vi.fn();
            renderWithOwner({ onReturnToTab });

            fireEvent.click(screen.getByText('launch'));
            expect(screen.getByTestId('return-label')).toHaveTextContent('Study these questions');

            fireEvent.click(screen.getByText('return'));

            expect(onReturnToTab).toHaveBeenCalledWith('flashcards');
            expect(screen.queryByRole('dialog')).toBeNull();
        });

        it('does not re-open the dialog for an intent addressed to another material', () => {
            // A stale or forward-looking intent must not hijack this material's Bank — and it is
            // left alone rather than consumed, so it can still be claimed where it belongs.
            renderWithOwner();

            fireEvent.click(screen.getByText('launch-other-material'));

            expect(screen.queryByRole('dialog')).toBeNull();
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('mat-2');
        });

        it('opens with no return action when the Bank was opened without a launcher', () => {
            // `documentMarkdown` is what enables the Bank's own "Generate with AI" — the tab
            // cannot synthesize from a material it has no content for.
            renderTab({ onReturnToTab: vi.fn(), documentMarkdown: '# Notes' });

            // The Bank's own "Generate with AI" — no intent, so no preselection and no way back.
            fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByTestId('initial-types')).toHaveTextContent('null');
            expect(screen.getByTestId('return-label')).toHaveTextContent('');
        });

        it('takes the claim during render, so the dialog is configured on the first paint', () => {
            // The claim is render-phase, not effect-phase: that is what makes the handoff land
            // on the first paint after the tab change instead of a frame later, and what lets
            // the return affordance outlive the claim. Server rendering runs no effects at all,
            // so a configured dialog in the markup can ONLY have come from a claim taken during
            // render — an effect-only claim would render nothing here.
            const onRetire = vi.fn();
            const markup = renderToString(
                <QuestionBankTab
                    questions={mockQuestions}
                    quizzes={mockQuizzes}
                    materialId="mat-1"
                    onCreate={mockOnCreate as any}
                    onUpdate={mockOnUpdate as any}
                    onPublish={mockOnPublish as any}
                    onArchive={mockOnArchive as any}
                    onUnarchive={mockOnUnarchive as any}
                    onReturnToTab={vi.fn()}
                    generatorLaunch={{ intent: fillInBlankLaunch, onRetire }}
                />,
            );

            expect(markup).toContain('generator-stub');
            // Configured from the claim itself: the launcher's types, and its way back.
            expect(markup).toContain('fill_in_blank');
            expect(markup).toContain('Study these questions');
            // And claiming does not reach back into the owner's state mid-render — that is a
            // cross-component render-phase update, which React rejects. Retirement is asked for
            // after the commit; the next test pins who actually performs it.
            expect(onRetire).not.toHaveBeenCalled();
        });

        /**
         * THE LATCH TEST. Retirement is asked for by an effect keyed on the **latched** claim,
         * not on an "unclaimed" flag, so it is reachable — and it fires only *after* the latch,
         * so it cannot take the open dialog's configuration with it. The two halves are the
         * same test: retiring during the claim (or by clearing the latch) empties the channel
         * and closes the dialog on the same commit, which the configuration assertions below
         * catch; never retiring leaves the channel armed, which the count catches.
         */
        it('retires the channel once the claim commits, and the dialog keeps its latched configuration', () => {
            renderWithOwner({ onReturnToTab: vi.fn() });

            fireEvent.click(screen.getByText('launch'));

            // The claim committed, so the owner's copy is retired: nothing is left pending for
            // a remount, a return, or a stale re-render to pick up.
            expect(retirements).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');

            // And the dialog is untouched by that retirement — `initialTypes` and the return
            // label are read from the LATCHED claim, not from the channel, so emptying the
            // channel cannot close the dialog or strip its configuration.
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByTestId('initial-types')).toHaveTextContent('["fill_in_blank"]');
            expect(screen.getByTestId('return-label')).toHaveTextContent('Study these questions');
        });

        it('retires a claim exactly once — re-renders and a later close do not retire it again', () => {
            renderWithOwner();

            fireEvent.click(screen.getByText('launch'));
            expect(retirements).toHaveBeenCalledTimes(1);

            // A re-render must not re-request retirement. It would be harmless at the owner
            // (the channel is already empty) but it makes "one-shot" unobservable, and a
            // consumer whose `onRetire` is not reference-stable re-registers the effect every
            // render — which is exactly the shape the workspace's `useCallback` avoids but a
            // test owner does not.
            fireEvent.change(screen.getByPlaceholderText('Search prompts and tags…'), {
                target: { value: 'water' },
            });
            expect(retirements).toHaveBeenCalledTimes(1);

            // `close` is the idempotent fallback, and closing still works after the effect
            // already retired: it closes the dialog and drops the latch without a second
            // retirement.
            fireEvent.click(screen.getByText('close'));
            expect(screen.queryByRole('dialog')).toBeNull();
            expect(retirements).toHaveBeenCalledTimes(1);
        });

        it("closes the Bank's own dialog without retiring a channel it never claimed from", () => {
            // The ordinary case: no launch, so there is no latched claim and nothing to
            // retire. `close` must still close the dialog — that is the half of its contract
            // that does not depend on a launch at all.
            renderWithOwner({ documentMarkdown: '# Notes' });

            fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(retirements).not.toHaveBeenCalled();

            fireEvent.click(screen.getByText('close'));

            expect(screen.queryByRole('dialog')).toBeNull();
            expect(retirements).not.toHaveBeenCalled();
        });

        it('closing the generator leaves the channel empty', () => {
            // `close` must leave the channel empty whatever retired it — that is the one-shot
            // guarantee. An intent the owner still holds would be re-claimed on the very next
            // render (the claim is keyed on "pending and unclaimed") and re-arm the dialog the
            // user just dismissed.
            renderWithOwner();

            fireEvent.click(screen.getByText('launch'));
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');

            fireEvent.click(screen.getByText('close'));

            expect(screen.queryByRole('dialog')).toBeNull();
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');
        });

        /**
         * SUPERSESSION. A launch is retired by naming it, so a dialog that has already been
         * replaced cannot destroy the launch that replaced it. The Bank has ONE generator, so
         * the second launch waits on the channel while the first dialog is still up — and the
         * first dialog's `close()` must leave it there to be claimed.
         */
        it('a superseded dialog\'s close does not clear the launch that replaced it', () => {
            renderWithOwner({ onReturnToTab: vi.fn() });

            fireEvent.click(screen.getByText('launch'));
            expect(screen.getByTestId('initial-types')).toHaveTextContent('["fill_in_blank"]');

            // A second launch for the SAME material is armed while the first dialog is open.
            fireEvent.click(screen.getByText('launch-again'));
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('mat-1:Study these too');
            // The one dialog still shows the first launch: there is a single generator.
            expect(screen.getByTestId('return-label')).toHaveTextContent('Study these questions');

            // The first dialog closes. Its `close()` retires the claim IT latched — not
            // whatever the channel now holds — so the second launch survives and is claimed in
            // the same commit. An unconditional empty-the-channel `close` destroys L2 here and
            // the dialog never comes back.
            fireEvent.click(screen.getByText('close'));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByTestId('initial-types')).toHaveTextContent('["true_false","identification"]');
            expect(screen.getByTestId('return-label')).toHaveTextContent('Study these too');
            // ...and it is now spent in its own right, exactly like the first.
            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');
        });

        it('spends the launch: a later visit to the Bank finds nothing to re-open', () => {
            // One-shot means the launch is spent by being acted on, whichever way the user
            // leaves — saved, cancelled, or via the way back. The owner's channel is empty and
            // the Bank's own "Generate with AI" now opens the plain mixed default.
            renderWithOwner({ onReturnToTab: vi.fn(), documentMarkdown: '# Notes' });

            fireEvent.click(screen.getByText('launch'));
            fireEvent.click(screen.getByText('return'));

            expect(screen.getByTestId('owner-intent')).toHaveTextContent('none');

            // Back in the Bank (the workspace keeps the tab mounted) — no dialog was re-armed…
            expect(screen.queryByRole('dialog')).toBeNull();

            // …and the Bank's own entry point carries no trace of the spent launch.
            fireEvent.click(screen.getByRole('button', { name: /Generate with AI/i }));
            expect(screen.getByTestId('initial-types')).toHaveTextContent('null');
            expect(screen.getByTestId('return-label')).toHaveTextContent('');
        });
    });
});
