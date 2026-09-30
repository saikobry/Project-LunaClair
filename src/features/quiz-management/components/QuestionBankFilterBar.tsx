import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Filter, Plus, Sparkles, X } from 'lucide-react';
import type { QuestionDifficulty, QuestionStatus } from '../../../domain/quiz/models/Question';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../../domain/quiz/models/questionMetadata';
import { Button } from '../../../shared/ui/Button/Button';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { SearchInput } from '../../../shared/ui/SearchInput/SearchInput';
import { Selector, type SelectorOption } from '../../../shared/ui/Selector/Selector';
import { styles } from './questionBankFilterBar.stylex';

const TYPE_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All types' },
    ...QUESTION_TYPES.map((value) => ({ value, label: QUESTION_TYPE_LABELS[value] })),
];

const DIFFICULTY_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All difficulty' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
];

const STATUS_OPTIONS: SelectorOption[] = [
    { value: '', label: 'All status' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' },
];

/** Tag pills shown before the `+N more` expander earns its place. */
const VISIBLE_TAG_COUNT = 8;

export interface QuestionBankFilterBarProps {
    /** Live search text. Matching is on prompt OR tags (leading `#` stripped by the caller). */
    search: string;
    onSearchChange: (value: string) => void;
    typeFilter: QuestionType | '';
    onTypeFilterChange: (value: QuestionType | '') => void;
    difficultyFilter: QuestionDifficulty | '';
    onDifficultyFilterChange: (value: QuestionDifficulty | '') => void;
    statusFilter: QuestionStatus | '';
    onStatusFilterChange: (value: QuestionStatus | '') => void;
    /**
     * Every tag across the questions in scope, frequency-ranked, with any selected tag already
     * pinned. Supplied by the tab (which owns the question list) so this bar stays presentational.
     */
    allTags: string[];
    /** The Bank's active tag filter — the SAME array the per-question chips toggle. */
    selectedTags: string[];
    onToggleTag: (tag: string) => void;
    /** How many filters are narrowing the list — drives the trigger's label and emphasis. */
    activeFilterCount: number;
    /**
     * Whether the Bank can generate at all: synthesis needs the material's document, so with no
     * markdown the action is disabled and says why rather than failing on click.
     */
    canGenerate: boolean;
    onOpenGenerator: () => void;
    onCreateQuestion: () => void;
}

interface TagFacetChipsProps {
    /** The tags to render, already in facet order. The surface owning the facet decides WHICH. */
    tags: string[];
    selectedTagSet: ReadonlySet<string>;
    onToggleTag: (tag: string) => void;
}

/**
 * The tag CHIPS — one implementation, rendered by whichever surface owns the tag facet at the
 * current width: the desktop `tagGroup` row (capped, with the `+N more` expander beside it) or the
 * <769px `Filter` disclosure panel (every tag, uncapped). Mirrors the Materials LibraryView filter
 * pill treatment: `styles.filterPill` / `filterPillActive`, a dimmed `aria-hidden` `#` hash sigil,
 * the `selectedTags` toggle, decorative remove `X`, and `aria-pressed`.
 */
function TagFacetChips({ tags, selectedTagSet, onToggleTag }: TagFacetChipsProps) {
    return (
        <>
            {tags.map((tag) => {
                const isActive = selectedTagSet.has(tag);
                return (
                    <button
                        key={tag}
                        type="button"
                        aria-pressed={isActive}
                        {...stylex.props(styles.filterPill, isActive && styles.filterPillActive)}
                        onClick={() => onToggleTag(tag)}
                    >
                        <span
                            aria-hidden="true"
                            {...stylex.props(styles.filterHash, isActive && styles.filterHashActive)}
                        >#</span>{tag}
                        {/* Decorative confirmation that clicking again removes the
                            filter — the pill itself is the control, so the icon is
                            aria-hidden and adds no nested focusable element. */}
                        {isActive && <X size={10} aria-hidden="true" />}
                    </button>
                );
            })}
        </>
    );
}

/**
 * The Question Bank's action bar: search, the three filters, the Bank's own two entry points.
 *
 * Extracted from `QuestionBankTab` because it is a distinct rendered section with one job —
 * narrowing and starting — and leaving it inline made the tab a 300-line body. It owns only the
 * <768px disclosure state of the filters, which is presentation of this bar and nothing else;
 * the filter values themselves stay with the tab, which is what derives the list from them.
 *
 * The bar is THREE rows at >=769px. Below it, the tag facet is not a fourth/second row: it rides
 * INSIDE the existing `Filter (N)` disclosure, so the question list starts directly under the
 * search row instead of below a chip set that wraps to several lines. Which surface renders the
 * facet is ONE boolean read from the same 769px boundary the stylesheet uses, and the two branches
 * are mutually exclusive — so the `role="group"` / `aria-label="Filter by tag"` landmark exists
 * exactly once in the document at any width, and the chips are never in the document twice.
 */
export function QuestionBankFilterBar({
    search,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    difficultyFilter,
    onDifficultyFilterChange,
    statusFilter,
    onStatusFilterChange,
    allTags,
    selectedTags,
    onToggleTag,
    activeFilterCount,
    canGenerate,
    onOpenGenerator,
    onCreateQuestion,
}: QuestionBankFilterBarProps) {
    // <768px the three selectors AND the tag facet collapse behind one disclosure; >=769px the
    // selectors sit inline in the bar and the tag facet is its own full-width row. The breakpoint
    // itself lives in the stylesheet; this is the matching DOM decision, read from the same
    // boundary so the markup and the media query cannot disagree about which surface owns the
    // facet. Below the boundary it degrades to the desktop row, never to a hidden facet.
    const isCompact = useMediaQuery('(max-width: 768px)');
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

    // The tag facet is capped at VISIBLE_TAG_COUNT, and a SELECTED tag is never hidden by the cap:
    // it stays in the row even past the cut, so an active filter always keeps its deselect
    // affordance. The expander reveals the rest; `Show fewer` reverses it.
    const selectedTagSet = new Set(selectedTags);
    const [showAllTags, setShowAllTags] = useState(false);
    const visibleTags = showAllTags
        ? allTags
        : allTags.filter((tag, i) => i < VISIBLE_TAG_COUNT || selectedTagSet.has(tag));
    const hiddenTagCount = allTags.length - visibleTags.length;

    // What the `Filter (N)` trigger reports: the active selector facets PLUS the active tags,
    // because below 769px the tags are inside the panel this trigger opens — a user with two tags
    // selected who reads `Filter (0)` would conclude nothing is filtered. Nothing is counted twice:
    // `activeFilterCount` is one per non-empty selector facet (a facet is either set or not), and
    // the tag half is the Set's SIZE, so a tag can contribute at most once however the array
    // arrived. The emphasis reads the same number, so the label and the treatment cannot disagree.
    const activeCount = activeFilterCount + selectedTagSet.size;

    return (
        <div {...stylex.props(styles.filterContainer)}>
            {/* Row 1 — search + selector dropdowns on ONE full-width row; search grows to fill. */}
            <div {...stylex.props(styles.searchRow)}>
                <div {...stylex.props(styles.searchField)}>
                    <SearchInput
                        label="Search questions"
                        placeholder="Search prompts and tags…"
                        value={search}
                        onChange={onSearchChange}
                        size="sm"
                    />
                </div>

                <div
                    {...stylex.props(styles.selectorGroup)}
                    role="group"
                    aria-label="Filter by type, difficulty, and status"
                >
                    <div {...stylex.props(styles.desktopSelectors)}>
                        <Selector
                            label="Filter by type"
                            isLabelHidden
                            options={TYPE_OPTIONS}
                            value={typeFilter}
                            onChange={(v) => onTypeFilterChange(v as QuestionType | '')}
                            size="sm"
                            width={160}
                        />
                        <Selector
                            label="Filter by difficulty"
                            isLabelHidden
                            options={DIFFICULTY_OPTIONS}
                            value={difficultyFilter}
                            onChange={(v) => onDifficultyFilterChange(v as QuestionDifficulty | '')}
                            size="sm"
                            width={150}
                        />
                        <Selector
                            label="Filter by status"
                            isLabelHidden
                            options={STATUS_OPTIONS}
                            value={statusFilter}
                            onChange={(v) => onStatusFilterChange(v as QuestionStatus | '')}
                            size="sm"
                            width={150}
                        />
                    </div>
                    <div {...stylex.props(styles.mobileFilterTrigger)}>
                        <Button
                            label="Toggle filters"
                            variant={activeCount > 0 ? 'primary' : 'secondary'}
                            icon={<Filter size={14} />}
                            aria-expanded={isFilterPanelOpen}
                            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                        >
                            Filter{activeCount > 0 ? ` (${activeCount})` : ''}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Row 2 — the tag facet on its own full-width row, >=769px ONLY. Below the breakpoint
                the same chips render inside the `Filter` panel instead, so the list begins
                directly under row 1; the two branches are exclusive, so the landmark and the chips
                are in the document exactly once. */}
            {!isCompact && allTags.length > 0 && (
                <div {...stylex.props(styles.tagGroup)} role="group" aria-label="Filter by tag">
                    <TagFacetChips
                        tags={visibleTags}
                        selectedTagSet={selectedTagSet}
                        onToggleTag={onToggleTag}
                    />

                    {hiddenTagCount > 0 && (
                        <button
                            type="button"
                            {...stylex.props(styles.tagMore)}
                            onClick={() => setShowAllTags(true)}
                            aria-label={`Show ${hiddenTagCount} more tags`}
                        >
                            +{hiddenTagCount} more
                        </button>
                    )}
                    {showAllTags && allTags.length > VISIBLE_TAG_COUNT && (
                        <button
                            type="button"
                            {...stylex.props(styles.tagMore)}
                            onClick={() => setShowAllTags(false)}
                        >
                            Show fewer
                        </button>
                    )}
                </div>
            )}

            {/* Row 3 — the two entry-point actions, LAST, right-aligned. A sibling of the search
                row and the tag row, not a child of either: it only *looked* like its own row before
                because the search field's `flex: 1` forced it to wrap onto one. */}
            <div {...stylex.props(styles.actionsGroup)} role="group" aria-label="Question actions">
                <Button
                    label="Generate with AI"
                    variant="secondary"
                    icon={<Sparkles size={14} />}
                    onClick={onOpenGenerator}
                    isDisabled={!canGenerate}
                    tooltip={canGenerate ? 'Generate questions with AI' : 'Document markdown is not available'}
                >
                    Generate with AI
                </Button>
                <Button
                    label="New question"
                    variant="primary"
                    icon={<Plus size={14} />}
                    onClick={onCreateQuestion}
                >
                    New Question
                </Button>
            </div>

            {isCompact && isFilterPanelOpen && (
                <div {...stylex.props(styles.mobileFilterPanel)}>
                    <Selector
                        label="Filter by type"
                        options={TYPE_OPTIONS}
                        value={typeFilter}
                        onChange={(v) => onTypeFilterChange(v as QuestionType | '')}
                        size="sm"
                    />
                    <Selector
                        label="Filter by difficulty"
                        options={DIFFICULTY_OPTIONS}
                        value={difficultyFilter}
                        onChange={(v) => onDifficultyFilterChange(v as QuestionDifficulty | '')}
                        size="sm"
                    />
                    <Selector
                        label="Filter by status"
                        options={STATUS_OPTIONS}
                        value={statusFilter}
                        onChange={(v) => onStatusFilterChange(v as QuestionStatus | '')}
                        size="sm"
                    />
                    {/* The tag facet, folded in: UNCAPPED. The panel has the full width to wrap, so
                        capping here would bury filters behind a second disclosure inside the first
                        — the exact cost this move exists to remove. The landmark is the same one
                        the desktop row renders, and the row is not in the DOM at this width. */}
                    {allTags.length > 0 && (
                        <div
                            {...stylex.props(styles.tagGroup)}
                            role="group"
                            aria-label="Filter by tag"
                        >
                            <TagFacetChips
                                tags={allTags}
                                selectedTagSet={selectedTagSet}
                                onToggleTag={onToggleTag}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
