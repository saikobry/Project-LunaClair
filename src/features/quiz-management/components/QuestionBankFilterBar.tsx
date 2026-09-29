import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Filter, Plus, Sparkles } from 'lucide-react';
import type { QuestionDifficulty, QuestionStatus } from '../../../domain/quiz/models/Question';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../../domain/quiz/models/questionMetadata';
import { Button } from '../../../shared/ui/Button/Button';
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

/**
 * The Question Bank's action bar: search, the three filters, the Bank's own two entry points.
 *
 * Extracted from `QuestionBankTab` because it is a distinct rendered section with one job —
 * narrowing and starting — and leaving it inline made the tab a 300-line body. It owns only the
 * <768px disclosure state of the filters, which is presentation of this bar and nothing else;
 * the filter values themselves stay with the tab, which is what derives the list from them.
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
    activeFilterCount,
    canGenerate,
    onOpenGenerator,
    onCreateQuestion,
}: QuestionBankFilterBarProps) {
    // <768px the three selectors collapse behind a disclosure; >=769px they sit inline in the bar
    // and the trigger is hidden. The breakpoint itself lives in the stylesheet.
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

    return (
        <>
            <div {...stylex.props(styles.filterBar)}>
                <div {...stylex.props(styles.searchField)}>
                    <SearchInput
                        label="Search questions"
                        placeholder="Search prompts and tags…"
                        value={search}
                        onChange={onSearchChange}
                        size="sm"
                    />
                </div>
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
                        variant={activeFilterCount > 0 ? 'primary' : 'secondary'}
                        icon={<Filter size={14} />}
                        onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                    >
                        Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                </div>
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
                    {...stylex.props(styles.newQuestionButton)}
                >
                    New Question
                </Button>
            </div>

            {isFilterPanelOpen && (
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
                </div>
            )}
        </>
    );
}
