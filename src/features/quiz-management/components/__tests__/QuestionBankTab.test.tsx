import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { QuestionBankTab } from '../QuestionBankTab';
import type {
    GeneratorLaunchChannel,
    GeneratorLaunchIntent,
} from '../../hooks/useGeneratorLaunchClaim';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import { styles } from '../questionBank.stylex';
import { styles as filterBarStyles } from '../questionBankFilterBar.stylex';

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

    /** Card-scoped queries: a tag renders BOTH in the filter section and on cards, so a bare
     * `getByText('#tag')` is ambiguous. These tests name the surface they mean. */
    const cardFor = (prompt: string) =>
        within(screen.getByText(prompt).closest<HTMLDivElement>('div[style*="border"]')!);

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

        const biologyTagChip = cardFor('What organelle produces energy?').getByText('#biology');
        fireEvent.click(biologyTagChip);

        expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
        expect(screen.queryByText('Is water a polar molecule?')).not.toBeInTheDocument();

        // Click again to toggle off
        fireEvent.click(biologyTagChip);
        expect(screen.getByText('Is water a polar molecule?')).toBeInTheDocument();
    });

    /**
     * The tag chip port. A Bank tag is a filter toggle (`aria-pressed`), so it carries the
     * treatment of the material card's tag toggle — one look for both surfaces, no cross-feature
     * import. These assertions are deliberately about what a user can see: a styling port that
     * quietly dropped the tag row or any neighbouring metadata is the failure mode here.
     */
    describe('card tag rendering', () => {
        it('renders every tag on the card as a chip', () => {
            renderTab();

            // q-1 carries two tags, q-2 and q-3 one each — every tag must survive the port.
            expect(cardFor('What organelle produces energy?').getByText('#biology')).toBeInTheDocument();
            expect(cardFor('What organelle produces energy?').getByText('#cell')).toBeInTheDocument();
            expect(cardFor('Is water a polar molecule?').getByText('#chemistry')).toBeInTheDocument();
            expect(cardFor('Identify Newton first law concept').getByText('#physics')).toBeInTheDocument();
            expect(screen.getAllByTitle(/^Filter by tag: /)).toHaveLength(4);
        });

        it('renders no tag row at all for a question with no tags', () => {
            // Same question, tags removed — so its quiz usage and every other field stay identical.
            const untagged: Question = { ...mockQuestions[0], tags: [] };
            renderTab({ questions: [untagged] });

            // No chip, no stray '#' — the untagged card renders exactly as it did before the port.
            expect(screen.queryByTitle(/^Filter by tag: /)).toBeNull();
            expect(screen.queryByText(/^#/)).toBeNull();

            // ...and the rest of the card is untouched by the absent row.
            expect(screen.getByText('What organelle produces energy?')).toBeInTheDocument();
            expect(screen.getByText('published')).toBeInTheDocument();
            expect(screen.getByText('1 pt')).toBeInTheDocument();
            expect(screen.getByText('v1')).toBeInTheDocument();
            expect(screen.getByText('Used in 1 quiz')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Edit question: What organelle/i })).toBeInTheDocument();
        });

        it('keeps every other card field when tags are present (no metadata dropped by the port)', () => {
            renderTab();

            const prompt = screen.getByText('What organelle produces energy?');
            const card = prompt.closest<HTMLDivElement>('div[style*="border"]')!;
            const cardScope = within(card);

            // Status + badges
            expect(cardScope.getByText('published')).toBeInTheDocument();
            expect(cardScope.getByText('1 pt')).toBeInTheDocument();
            expect(cardScope.getByText('easy')).toBeInTheDocument();
            expect(cardScope.getByText('Multiple Choice')).toBeInTheDocument();

            // Tags, prompt and explanation
            expect(cardScope.getByText('#biology')).toBeInTheDocument();
            expect(cardScope.getByText('#cell')).toBeInTheDocument();
            expect(cardScope.getByText('Explanation')).toBeInTheDocument();
            expect(cardScope.getByText('Mitochondria produces ATP.')).toBeInTheDocument();

            // Footer metadata + actions
            expect(cardScope.getByText('v1')).toBeInTheDocument();
            expect(cardScope.getByText('Used in 1 quiz')).toBeInTheDocument();
            expect(cardScope.getByRole('button', { name: /Edit question: What organelle/i })).toBeInTheDocument();
            expect(cardScope.getByRole('button', { name: /Archive question: What organelle/i })).toBeInTheDocument();
        });
    });

    /**
     * The tag filter as REAL filter state. The Bank used to fake it: clicking a chip wrote
     * `#tag` into the search box and the list was filtered by that text, so the two controls
     * were the same control. This block pins the replacement — a multi-select set, OR within the
     * facet, independent of the search field.
     */
    describe('tag filtering (multi-select, independent of search)', () => {
        // Two questions share a tag and each carries a second, distinct one, so a selection can
        // be asserted while MULTIPLE chips are still on screen. The old exclusivity test clicked
        // a unique tag, which filtered the list to one card and made its own claim unexercised.
        const tagQuestions: Question[] = [
            { ...mockQuestions[0], id: 'tag-1', prompt: 'Alpha shares biology', tags: ['biology', 'cell'] },
            { ...mockQuestions[1], id: 'tag-2', prompt: 'Beta shares biology', tags: ['biology', 'chemistry'] },
            { ...mockQuestions[2], id: 'tag-3', prompt: 'Gamma is physics only', tags: ['physics'] },
        ];

        const searchInput = () => screen.getByPlaceholderText('Search prompts and tags…');

        it('selects multiple tags at once and shows every question matching any of them', () => {
            renderTab({ questions: tagQuestions });

            // Two chips carry `#biology`, so the first click is deliberately scoped by index.
            fireEvent.click(screen.getAllByText('#biology')[0]);

            // OR within the facet: both biology questions survive, the physics-only one does not.
            expect(screen.getByText('Alpha shares biology')).toBeInTheDocument();
            expect(screen.getByText('Beta shares biology')).toBeInTheDocument();
            expect(screen.queryByText('Gamma is physics only')).not.toBeInTheDocument();

            fireEvent.click(within(screen.getByRole('group', { name: 'Filter by tag' })).getByRole('button', { name: 'chemistry' }));

            // A second tag ADDS to the filter rather than replacing the first.
            expect(screen.getByText('Alpha shares biology')).toBeInTheDocument();
            expect(screen.getByText('Beta shares biology')).toBeInTheDocument();
            expect(screen.queryByText('Gamma is physics only')).not.toBeInTheDocument();

            // Exclusivity, with every chip still present: both selected chips on Beta's card are
            // pressed and the unrelated one on Alpha's card is not.
            const betaScope = cardFor('Beta shares biology');
            expect(betaScope.getByText('#biology')).toHaveAttribute('aria-pressed', 'true');
            expect(betaScope.getByText('#chemistry')).toHaveAttribute('aria-pressed', 'true');

            const alphaScope = cardFor('Alpha shares biology');
            expect(alphaScope.getByText('#biology')).toHaveAttribute('aria-pressed', 'true');
            expect(alphaScope.getByText('#cell')).toHaveAttribute('aria-pressed', 'false');
        });

        it('deselects a tag when its chip is clicked again', () => {
            renderTab({ questions: tagQuestions });

            fireEvent.click(screen.getAllByText('#biology')[0]);
            expect(screen.queryByText('Gamma is physics only')).not.toBeInTheDocument();

            fireEvent.click(screen.getAllByText('#biology')[0]);

            expect(
                screen.getAllByText('#biology').every((chip) => chip.getAttribute('aria-pressed') === 'false'),
            ).toBe(true);
            expect(screen.getByText('Gamma is physics only')).toBeInTheDocument();
        });

        it('toggling a tag does not write into the search field', () => {
            renderTab({ questions: tagQuestions });

            fireEvent.click(screen.getAllByText('#biology')[0]);

            // The old mechanic faked filtering by typing '#biology' into the search box. A real
            // tag selection must leave the search text exactly as the user left it.
            expect(searchInput()).toHaveValue('');
        });

        it('typing in the search field does not clear the selected tags', () => {
            renderTab({ questions: tagQuestions });

            fireEvent.click(screen.getAllByText('#biology')[0]);
            fireEvent.change(searchInput(), { target: { value: 'alpha' } });

            // Search narrows further (AND across facets); the tag selection is untouched.
            expect(screen.getByText('Alpha shares biology')).toBeInTheDocument();
            expect(screen.queryByText('Beta shares biology')).not.toBeInTheDocument();
            expect(cardFor('Alpha shares biology').getByText('#biology')).toHaveAttribute('aria-pressed', 'true');
        });

        it('clearing the search leaves the tag filter in place', () => {
            renderTab({ questions: tagQuestions });

            fireEvent.click(screen.getAllByText('#biology')[0]);
            fireEvent.change(searchInput(), { target: { value: 'alpha' } });
            fireEvent.change(searchInput(), { target: { value: '' } });

            // The two mechanisms are independent in both directions: emptying the search box does
            // not silently drop the tag filter.
            expect(screen.getByText('Beta shares biology')).toBeInTheDocument();
            expect(cardFor('Beta shares biology').getByText('#biology')).toHaveAttribute('aria-pressed', 'true');
        });
    });

    /**
     * Style binding for the ported tag chip. The text/title/aria assertions elsewhere prove the
     * chip renders and toggles; NONE of them would fail if `styles.tag` / `styles.tagPressed`
     * were deleted, because a rule set that never reaches the DOM still passes a text query. This
     * block binds the rendered element to the rule it must carry. Vitest mocks `stylex.props` to
     * serialize each rule object into the class name (see `src/test/setup.ts`), so comparing
     * against `JSON.stringify(styles.<rule>)` is the same string the component produced.
     */
    describe('tag chip style binding', () => {
        it('binds a rendered tag chip to the tag rule set', () => {
            renderTab();

            const chip = cardFor('What organelle produces energy?').getByText('#biology');

            expect(chip.className).toContain(JSON.stringify(styles.tag));
        });

        it('binds the active tag to the pressed rule set', () => {
            renderTab();

            fireEvent.click(cardFor('What organelle produces energy?').getByText('#biology'));

            const chip = cardFor('What organelle produces energy?').getByText('#biology');
            expect(chip.className).toContain(JSON.stringify(styles.tag));
            expect(chip.className).toContain(JSON.stringify(styles.tagPressed));
        });

        /**
         * The chip's INTERNAL spacing. A selected bar chip's remove `X` used to sit hard against
         * the label — the chip's horizontal padding was the only separation — so the shared rule
         * carries the Material Library's `filterPill` `gap: 4`.
         *
         * Asserted on the rule (jsdom has no layout, so a rendered chip's spacing is unobservable)
         * and then on BOTH call sites' content, because that is what makes the gap safe to share:
         * `gap` separates flex ITEMS, and the per-question row chip's whole content is one
         * contiguous run of text — a single anonymous item — so there is nothing there for the gap
         * to separate. The spacing therefore reaches the selected filter-bar chip and its mobile
         * twin, and cannot loosen the row chips. Verified in Chromium too: the row chip's measured
         * width is identical with and without the declaration, while the selected chip's
         * label-to-icon distance goes from 0px to 4px.
         */
        it('separates the label from the remove X with a gap, inert on the single-item row chip', () => {
            renderTab();

            expect(filterBarStyles.filterPill.gap).toBe(4);
            expect(styles.tag.gap).toBe(4);

            // The row chip: `#{tag}` as contiguous text, so ZERO element children — one anonymous
            // flex item, and the shared gap has nothing to separate.
            const rowChip = cardFor('What organelle produces energy?').getByText('#biology');
            expect(rowChip.children).toHaveLength(0);
            expect(rowChip.className).toContain(JSON.stringify(styles.tag));

            // The bar's SELECTED chip is the surface with the dimmed # and the remove X.
            const group = screen.getByRole('group', { name: 'Filter by tag' });
            const sectionChip = within(group).getByRole('button', { name: 'biology' });
            fireEvent.click(sectionChip);

            const selected = within(group).getByRole('button', { name: 'biology' });
            expect(selected.children).toHaveLength(2);
            expect(selected.children[0].tagName.toLowerCase()).toBe('span');
            expect(selected.children[1].tagName.toLowerCase()).toBe('svg');
        });
    });

    /**
     * The tag filter SECTION in the bar — the missing half. It is the same control as a card's tag
     * chip (one `selectedTags` array), capped at 8 with a selected tag never hidden by the cap.
     */
    describe('tag filter section', () => {
        const tagGroup = () => screen.getByRole('group', { name: 'Filter by tag' });
        const tagChip = (container: HTMLElement, tag: string) =>
            within(container).getByRole('button', { name: tag });

        it('renders a chip for every tag it was handed', () => {
            renderTab();

            const group = tagGroup();
            expect(tagChip(group, 'biology')).toBeInTheDocument();
            expect(tagChip(group, 'cell')).toBeInTheDocument();
            expect(tagChip(group, 'chemistry')).toBeInTheDocument();
            expect(tagChip(group, 'physics')).toBeInTheDocument();
        });

        it('shares one selectedTags array between the section chips and the per-question chips', () => {
            renderTab();
            const group = tagGroup();

            // Toggle from the SECTION chip…
            fireEvent.click(tagChip(group, 'biology'));
            expect(tagChip(group, 'biology')).toHaveAttribute('aria-pressed', 'true');
            // …and the per-question chip on the matching card shows the same state.
            expect(cardFor('What organelle produces energy?').getByText('#biology')).toHaveAttribute(
                'aria-pressed',
                'true',
            );

            // Deselect from the QUESTION chip — the same tag — and the section chip follows.
            fireEvent.click(cardFor('What organelle produces energy?').getByText('#biology'));
            expect(tagChip(group, 'biology')).toHaveAttribute('aria-pressed', 'false');
        });

        it('renders a two-tier tag design: filter bar pill and compact card tag', () => {
            renderTab();

            // Two-tier design mirroring the Materials feature: the filter bar renders its own
            // `filterPill` rule (matching LibraryView), while question cards render the compact
            // `tag` rule (matching MaterialCard).
            const sectionChip = tagChip(tagGroup(), 'biology');
            const cardChip = cardFor('What organelle produces energy?').getByText('#biology');
            expect(sectionChip.className).toContain(JSON.stringify(filterBarStyles.filterPill));
            expect(cardChip.className).toContain(JSON.stringify(styles.tag));

            // …and on the ACTIVE state, each adds its own pressed rule.
            fireEvent.click(sectionChip);
            expect(tagChip(tagGroup(), 'biology').className).toContain(
                JSON.stringify(filterBarStyles.filterPillActive),
            );
            expect(cardFor('What organelle produces energy?').getByText('#biology').className).toContain(
                JSON.stringify(styles.tagPressed),
            );
        });

        it('shows the remove X on a selected tag pill only', () => {
            renderTab();
            const group = tagGroup();

            // Unselected: no icon at all.
            const unselected = tagChip(group, 'biology');
            expect(unselected.querySelector('svg')).toBeNull();

            fireEvent.click(unselected);

            // Selected: the X appears as the click-again-to-remove confirmation.
            const selected = tagChip(group, 'biology');
            expect(selected.querySelector('svg')).not.toBeNull();
        });

        it('adds no nested control and keeps the pill accessible name as the tag', () => {
            renderTab();
            const group = tagGroup();

            const unselected = tagChip(group, 'biology');
            expect(unselected.querySelectorAll('button')).toHaveLength(0);

            fireEvent.click(unselected);

            // Still exactly one button, still named by the tag — the X is aria-hidden decoration.
            const selected = tagChip(group, 'biology');
            expect(selected.querySelectorAll('button')).toHaveLength(0);
            expect(selected.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        });

        it('puts the search field and the selector dropdowns on ONE row, with the tag facet below and the actions last', () => {
            renderTab();

            const searchInput = screen.getByPlaceholderText('Search prompts and tags…');
            const selectionGroup = screen.getByRole('group', {
                name: 'Filter by type, difficulty, and status',
            });
            const tagGroupEl = screen.getByRole('group', { name: 'Filter by tag' });
            const actionsGroup = screen.getByRole('group', { name: 'Question actions' });

            // Row 1 contract: the search field shares ONE row with the selector dropdowns…
            const row = selectionGroup.parentElement!;
            expect(row.contains(searchInput)).toBe(true);
            // …and is not folded into the selector group itself.
            expect(searchInput.closest('[role="group"]')).toBeNull();

            // The entry-point actions are a SIBLING row, not a child of the search row: they used
            // to sit inside it and only *looked* like their own row because `flex: 1` forced the
            // wrap. All three groups share one parent — the bar.
            expect(actionsGroup.parentElement).toBe(row.parentElement);
            expect(tagGroupEl.parentElement).toBe(row.parentElement);

            // The tag facet is a SIBLING row BELOW the search row, not nested inside it…
            expect(row.contains(tagGroupEl)).toBe(false);
            // …and the actions are the bar's LAST row, after the tags.
            expect(
                tagGroupEl.compareDocumentPosition(actionsGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        });

        it('keeps the tag row and the actions row as siblings of the search row', () => {
            renderTab();

            const row = screen
                .getByRole('group', { name: 'Filter by type, difficulty, and status' })
                .parentElement!;
            const tagGroupEl = screen.getByRole('group', { name: 'Filter by tag' });
            const actionsGroup = screen.getByRole('group', { name: 'Question actions' });

            // The three rows are siblings under one parent — the bar. Asserted as DOM
            // relationships, not class names, so a StyleX rename cannot pass or fail this.
            expect(row.parentElement).toBe(tagGroupEl.parentElement);
            expect(row.parentElement).toBe(actionsGroup.parentElement);
            // Neither the tags nor the actions is nested inside the search row any more.
            expect(row.contains(tagGroupEl)).toBe(false);
            expect(row.contains(actionsGroup)).toBe(false);
        });

        it('renders the tags above the actions', () => {
            renderTab();

            const tagGroupEl = screen.getByRole('group', { name: 'Filter by tag' });
            const actionsGroup = screen.getByRole('group', { name: 'Question actions' });

            // Document order, so a reorder that keeps both on the bar still fails here.
            expect(
                tagGroupEl.compareDocumentPosition(actionsGroup) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
            expect(
                actionsGroup.compareDocumentPosition(tagGroupEl) & Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeFalsy();
        });

        it('caps the row at 8 tags and reveals the rest through the expander', () => {
            const many: Question[] = Array.from({ length: 10 }, (_, i) => ({
                ...mockQuestions[0],
                id: `many-${i}`,
                prompt: `Capped prompt ${i}`,
                tags: [`t${i}`],
            }));
            renderTab({ questions: many });

            const group = tagGroup();
            // The first 8 (frequency ties break alphabetically) are visible; the rest are not.
            expect(tagChip(group, 't7')).toBeInTheDocument();
            expect(within(group).queryByRole('button', { name: 't8' })).toBeNull();

            fireEvent.click(within(group).getByRole('button', { name: 'Show 2 more tags' }));
            expect(tagChip(group, 't8')).toBeInTheDocument();
            expect(tagChip(group, 't9')).toBeInTheDocument();

            fireEvent.click(within(group).getByText('Show fewer'));
            expect(within(group).queryByRole('button', { name: 't8' })).toBeNull();
        });

        it('never hides a selected tag behind the cap', () => {
            const many: Question[] = Array.from({ length: 10 }, (_, i) => ({
                ...mockQuestions[0],
                id: `pinned-${i}`,
                prompt: `Pinned prompt ${i}`,
                tags: [`t${i}`],
            }));
            renderTab({ questions: many });

            // `t9` is past the cap, so its section chip is hidden before selection...
            expect(within(tagGroup()).queryByRole('button', { name: 't9' })).toBeNull();

            // ...but selecting it from the CARD chip pins it into the section row regardless.
            fireEvent.click(cardFor('Pinned prompt 9').getByText('#t9'));

            expect(tagChip(tagGroup(), 't9')).toHaveAttribute('aria-pressed', 'true');
        });
    });

    /**
     * The <769px arrangement: the tag facet rides INSIDE the existing `Filter (N)` disclosure, so
     * the list starts under row 1 instead of below a chip set that wraps to several lines.
     *
     * jsdom has no layout, so the bar's stylesheet cannot relocate the facet — which is exactly
     * why the bar makes the placement decision in the DOM from the same 769px boundary, read
     * through `useMediaQuery`. The setup polyfill answers `matches: false` to every query, i.e. the
     * DESKTOP answer, so these tests stub it to the compact answer to exercise the real branch.
     * The stub is global, so it is restored after each test.
     */
    describe('tag facet inside the compact filter disclosure', () => {
        const originalMatchMedia = window.matchMedia;

        const setCompactViewport = (isCompact: boolean) => {
            window.matchMedia = vi.fn().mockImplementation((query: string) => ({
                matches: isCompact && query === '(max-width: 768px)',
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })) as unknown as typeof window.matchMedia;
        };

        afterEach(() => {
            window.matchMedia = originalMatchMedia;
        });

        const tagLandmarks = () => screen.queryAllByRole('group', { name: 'Filter by tag' });
        const filterTrigger = () => screen.getByRole('button', { name: 'Toggle filters' });
        const openPanel = () => fireEvent.click(filterTrigger());
        const bar = () => screen.getByRole('group', { name: 'Question actions' }).parentElement!;
        const panelRule = JSON.stringify(filterBarStyles.mobileFilterPanel);

        it('moves the chips into the panel and drops the standalone row', () => {
            setCompactViewport(true);
            renderTab();

            // Closed: the facet is nowhere in the document — no row between the search row and the
            // actions, so the content begins directly under row 1.
            expect(tagLandmarks()).toHaveLength(0);
            expect(filterTrigger()).toBeInTheDocument();

            openPanel();

            // Open: exactly one landmark, and it is inside the panel's bordered box.
            expect(tagLandmarks()).toHaveLength(1);
            const panel = tagLandmarks()[0].parentElement!;
            expect(panel).not.toBe(bar());
            expect(panel.className).toContain(panelRule);
            // The panel is the selectors PLUS the facet — nothing was dropped moving the chips in.
            expect(panel.querySelectorAll('select')).toHaveLength(3);
            expect(within(panel).getByRole('button', { name: 'biology' })).toBeInTheDocument();
            expect(within(panel).getByRole('button', { name: 'physics' })).toBeInTheDocument();
        });

        it('never has the standalone row and the panel in the document together', () => {
            setCompactViewport(true);
            renderTab();
            openPanel();

            // The duplication guard on its own: with the panel open, exactly one tag landmark
            // exists. Rendering the row as well would put the chips — and the landmark — in the
            // document twice, so a screen reader would announce two "Filter by tag" groups.
            expect(tagLandmarks()).toHaveLength(1);
        });

        it('shows every tag in the panel with no cap and no expander', () => {
            // 12 tags, past the desktop cap of 8: inside the panel they are all reachable without
            // a second disclosure nested in the first.
            const many: Question[] = Array.from({ length: 12 }, (_, i) => ({
                ...mockQuestions[0],
                id: `mobile-${i}`,
                prompt: `Mobile prompt ${i}`,
                tags: [`t${i}`],
            }));
            setCompactViewport(true);
            renderTab({ questions: many });
            openPanel();

            const group = tagLandmarks()[0];
            expect(within(group).getByRole('button', { name: 't0' })).toBeInTheDocument();
            expect(within(group).getByRole('button', { name: 't11' })).toBeInTheDocument();
            expect(within(group).queryByText('+4 more')).toBeNull();
            expect(within(group).queryByText('Show fewer')).toBeNull();
            expect(within(group).queryByRole('button', { name: /more tags/i })).toBeNull();
        });

        it('counts the selected tags in the Filter (N) trigger', () => {
            setCompactViewport(true);
            renderTab();

            expect(filterTrigger()).toHaveTextContent(/^Filter$/);

            // A tag selection must move the count: the panel this trigger opens is showing it, and
            // two active tags must not read `Filter (0)`.
            fireEvent.click(cardFor('What organelle produces energy?').getByText('#biology'));
            expect(filterTrigger()).toHaveTextContent(/^Filter \(1\)$/);

            fireEvent.click(cardFor('What organelle produces energy?').getByText('#cell'));
            expect(filterTrigger()).toHaveTextContent(/^Filter \(2\)$/);
        });

        it('adds the tags to the selector facets without counting a facet twice', () => {
            setCompactViewport(true);
            renderTab();

            // One selector facet counts once…
            fireEvent.change(screen.getByLabelText('Filter by type'), {
                target: { value: 'multiple_choice' },
            });
            expect(filterTrigger()).toHaveTextContent(/^Filter \(1\)$/);

            // …and each tag adds exactly one, however many tags the facet holds. The card the chips
            // are clicked on is the one this type keeps in the list.
            const cell = cardFor('What organelle produces energy?');
            fireEvent.click(cell.getByText('#biology'));
            expect(filterTrigger()).toHaveTextContent(/^Filter \(2\)$/);

            fireEvent.click(cell.getByText('#cell'));
            expect(filterTrigger()).toHaveTextContent(/^Filter \(3\)$/);

            // Deselecting removes exactly its own contribution.
            fireEvent.click(cell.getByText('#biology'));
            expect(filterTrigger()).toHaveTextContent(/^Filter \(2\)$/);
        });

        it('keeps the trigger name from understating what the panel holds', () => {
            setCompactViewport(true);
            renderTab();
            openPanel();

            // The name is the generic `Toggle filters` — it enumerates no facet, so folding the
            // tag facet in cannot make it understate the panel. Pinned so a facet-enumerating name
            // cannot land on the trigger without this failing.
            expect(filterTrigger()).toHaveAccessibleName('Toggle filters');
            // The disclosed body is the three selectors and the tag landmark — all four facets.
            const panel = tagLandmarks()[0].parentElement!;
            expect(panel.querySelectorAll('select')).toHaveLength(3);
            expect(within(panel).getByRole('group', { name: 'Filter by tag' })).toBeInTheDocument();
        });

        it('does not mount the panel at >=769px, so the row is never duplicated', () => {
            setCompactViewport(false);
            renderTab();

            // The trigger is CSS-hidden at this width; clicking it must not mount a second facet
            // beside the row, so the landmark stays singular at every width.
            openPanel();

            expect(tagLandmarks()).toHaveLength(1);
            expect(
                Array.from(bar().children).some((child) => child.className.includes(panelRule)),
            ).toBe(false);
        });
    });

    /**
     * The bar's own visual rules, pinned as rules. Vitest mocks `stylex.create` to hand the rule
     * object through unchanged (see `src/test/setup.ts`), so a rule can be inspected directly — and
     * asserting on the rule is what makes the absence real: a divider that merely stopped being
     * *rendered* would still be here, and a rule deleted from the file cannot satisfy a query for
     * its class name. The check is deliberately across EVERY rule in the bar's stylesheet, not
     * just `selectorGroup`, so a divider reappearing on any rule is caught too.
     */
    describe('filter bar rule sheet', () => {
        /** Every `borderRight*` declaration in the bar's stylesheet, by rule name. */
        const rightBorderRules = () =>
            Object.entries(filterBarStyles as Record<string, Record<string, unknown>>)
                .filter(([, rule]) => rule && typeof rule === 'object')
                .filter(([, rule]) => Object.keys(rule).some((prop) => prop.startsWith('borderRight')))
                .map(([name]) => name);

        it('declares no right-border divider on any rule', () => {
            // The bar's rows are separated by spacing, not by a rule. A dangling divider was
            // ported from the Material Library's `membershipGroup`, which borders a lens that HAS
            // controls to its right; here there was nothing after it to separate.
            expect(rightBorderRules()).toEqual([]);
        });

        it('renders the selector group without a divider, while keeping its group role', () => {
            renderTab();

            const selectorGroup = screen.getByRole('group', {
                name: 'Filter by type, difficulty, and status',
            });

            // The landmark the divider was decoration inside is untouched...
            expect(selectorGroup).toBeInTheDocument();
            // ...and the rule it carries is still the layout rule, just without the border.
            expect(selectorGroup.className).toContain(JSON.stringify(filterBarStyles.selectorGroup));
            expect(selectorGroup.className).not.toContain('borderRight');
        });
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
