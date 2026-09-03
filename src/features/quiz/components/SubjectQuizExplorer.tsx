import { useState, useMemo, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Check, BrainCircuit, BookOpen, Search, ChevronDown } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Input } from '../../../shared/ui/Input/Input';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import type { QuizTreeNodeTerm, QuizTreeNodeMaterial, QuizTreeNodeQuiz } from '../types/quizTree.types';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
  },
  termGroup: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    backgroundColor: 'var(--color-background-surface)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    transition: 'box-shadow 0.15s ease',
    ':hover': {
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    },
  },
  termHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    backgroundColor: 'var(--color-background-muted)',
    borderBottom: '1px solid var(--color-border)',
    gap: 12,
  },
  termHeaderToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    outlineStyle: 'none',
    outlineWidth: 0,
    color: 'inherit',
  },
  termTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  termTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--color-text-secondary)',
  },
  termCount: {
    fontSize: 11,
    color: 'var(--color-text-disabled)',
    fontWeight: 500,
  },
  chevron: {
    transition: 'transform 0.2s ease',
    color: 'var(--color-text-disabled)',
    flexShrink: 0,
  },
  chevronCollapsed: {
    transform: 'rotate(-90deg)',
  },
  actionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
    color: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent-muted)',
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outlineStyle: 'none',
    outlineWidth: 0,
    boxShadow: 'none',
    ':hover': {
      backgroundColor: 'var(--color-accent)',
      color: 'var(--color-on-accent)',
      boxShadow: 'none',
    },
    ':focus': {
      outlineStyle: 'none',
      outlineWidth: 0,
    },
    ':focus-visible': {
      outlineStyle: 'none',
      outlineWidth: 0,
    },
  },
  actionPillActive: {
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderStyle: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: 'none',
    ':hover': {
      backgroundColor: 'var(--color-border-light, var(--color-background-hover))',
      color: 'var(--color-text-primary)',
      boxShadow: 'none',
    },
  },
  materialHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px 10px 20px',
    borderBottom: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-background-surface)',
  },
  materialTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  quizList: {
    display: 'flex',
    flexDirection: 'column',
  },
  quizRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px 10px 28px',
    borderBottom: '1px solid var(--color-border-light)',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
    ':last-child': {
      borderBottom: 'none',
    },
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'var(--color-border-emphasized)',
    flexShrink: 0,
    color: 'transparent',
    backgroundColor: 'var(--color-background-surface)',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  checkboxChecked: {
    borderColor: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
  },
  quizInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  quizTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  quizBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--color-text-disabled)',
    fontWeight: 500,
  },
  draftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    backgroundColor: 'var(--color-warning-muted)',
    color: 'var(--color-on-warning-muted)',
    borderRadius: 4,
    lineHeight: 1.4,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    color: 'var(--color-text-disabled)',
    fontSize: 14,
    textAlign: 'center',
    gap: 8,
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTop: '1px solid var(--color-border)',
  },
  selectionCount: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  actionButtons: {
    display: 'flex',
    gap: 8,
  },
  contentBody: {
    overflow: 'hidden',
  },
  skeleton: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  skeletonItem: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'var(--color-background-muted)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
});

export interface SubjectQuizExplorerSelection {
  selectedQuizIds: Set<string>;
  totalSelectedQuizzes: number;
  totalSelectedQuestions: number;
  toggleQuiz: (quizId: string) => void;
  toggleMaterial: (materialId: string, quizIds: string[]) => void;
  toggleTerm: (quizIds: string[]) => void;
  toggleAll: (allQuizIds: string[]) => void;
}

export interface SubjectQuizExplorerProps {
  tree: QuizTreeNodeTerm[];
  selection: SubjectQuizExplorerSelection;
  isLoading?: boolean;
  onStartSingleQuiz: (quizId: string) => void;
  onStartUnifiedQuiz: (quizIds: string[]) => void;
}

function QuizNode({
  quiz,
  isSelected,
  onToggle,
}: {
  quiz: QuizTreeNodeQuiz;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const checkboxRef = useRef<HTMLDivElement>(null);

  // ── Snappy scale bounce when checkbox is checked ────────────
  useGSAP(() => {
    if (checkboxRef.current && isSelected) {
      gsap.fromTo(
        checkboxRef.current,
        { scale: 0.85 },
        { scale: 1, duration: 0.2, ease: 'back.out(2)', overwrite: 'auto' },
      );
    }
  }, { dependencies: [isSelected] });

  return (
    <div
      {...stylex.props(styles.quizRow)}
      onClick={onToggle}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div ref={checkboxRef} {...stylex.props(styles.checkbox, isSelected && styles.checkboxChecked)}>
        <Check size={12} strokeWidth={2.5} color="currentColor" />
      </div>
      <div {...stylex.props(styles.quizInfo)}>
        <span {...stylex.props(styles.quizTitle)}>{quiz.title}</span>
        <span {...stylex.props(styles.quizBadge)}>
          <BrainCircuit size={11} />
          {quiz.questionCount} Questions
          {quiz.quiz.status === 'draft' && (
            <span {...stylex.props(styles.draftBadge)}>Draft</span>
          )}
        </span>
      </div>
    </div>
  );
}

function MaterialNode({
  material,
  selectedQuizIds,
  onToggleQuiz,
  onToggleMaterial,
}: {
  material: QuizTreeNodeMaterial;
  selectedQuizIds: Set<string>;
  onToggleQuiz: (quizId: string) => void;
  onToggleMaterial: (materialId: string, quizIds: string[]) => void;
}) {
  const quizIds = material.quizzes.map((q) => q.id);
  const allSelected = quizIds.length > 0 && quizIds.every((id) => selectedQuizIds.has(id));

  return (
    <>
      <div {...stylex.props(styles.materialHeader)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <BookOpen size={14} color="var(--color-text-disabled)" />
          <span {...stylex.props(styles.materialTitle)}>{material.title}</span>
        </div>
        {quizIds.length > 1 && (
          <button
            type="button"
            {...stylex.props(styles.actionPill, allSelected && styles.actionPillActive)}
            onClick={() => onToggleMaterial(material.id, quizIds)}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>
      <div {...stylex.props(styles.quizList)}>
        {material.quizzes.map((quiz) => (
          <QuizNode
            key={quiz.id}
            quiz={quiz}
            isSelected={selectedQuizIds.has(quiz.id)}
            onToggle={() => onToggleQuiz(quiz.id)}
          />
        ))}
      </div>
    </>
  );
}

// ── Toolbar: term filter + search row + select-all ────────────────
function QuizExplorerToolbar({
  availableTerms,
  activeTermFilter,
  onTermFilterChange,
  searchQuery,
  onSearchChange,
  allQuizIds,
  selectedQuizIds,
  onToggleAll,
}: {
  availableTerms: Array<{ id: string; title: string }>;
  activeTermFilter: string | null;
  onTermFilterChange: (termId: string | null) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  allQuizIds: string[];
  selectedQuizIds: Set<string>;
  onToggleAll: (ids: string[]) => void;
}) {
  return (
    <>
      {availableTerms.length > 1 && (
        <SegmentedControl
          value={activeTermFilter ?? 'all'}
          onChange={(v: string) => onTermFilterChange(v === 'all' ? null : v)}
          label="Term filter"
          size="sm"
          layout="fill"
        >
          <SegmentedControlItem value="all" label="All" />
          {availableTerms.map((term) => (
            <SegmentedControlItem key={term.id} value={term.id} label={term.title} />
          ))}
        </SegmentedControl>
      )}

      <div {...stylex.props(styles.searchRow)}>
        <div {...stylex.props(styles.searchField)}>
          <Input
            label="Search quizzes"
            labelHidden
            startIcon={<Search size={16} />}
            placeholder="Search terms, materials, and quizzes..."
            value={searchQuery}
            onChange={onSearchChange}
            clearable
            autoFocus={false}
          />
        </div>
        {allQuizIds.length > 0 && (
          <button
            type="button"
            {...stylex.props(
              styles.actionPill,
              allQuizIds.every((id) => selectedQuizIds.has(id)) && styles.actionPillActive,
            )}
            onClick={() => onToggleAll(allQuizIds)}
          >
            {allQuizIds.every((id) => selectedQuizIds.has(id)) ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>
    </>
  );
}

// ── Term accordion group: collapsible term header + material/quiz tree ──
function TermAccordionGroup({
  term,
  isCollapsed,
  onToggleCollapsed,
  selectedQuizIds,
  onToggleTerm,
  onToggleQuiz,
  onToggleMaterial,
}: {
  term: QuizTreeNodeTerm;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  selectedQuizIds: Set<string>;
  onToggleTerm: (quizIds: string[]) => void;
  onToggleQuiz: (quizId: string) => void;
  onToggleMaterial: (materialId: string, quizIds: string[]) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const termQuizIds = term.materials.flatMap((m) => m.quizzes.map((q) => q.id));
  const allTermSelected = termQuizIds.length > 0 && termQuizIds.every((id) => selectedQuizIds.has(id));

  // ── Expand / collapse animation ───────────────────────────
  const prevCollapsed = useRef(isCollapsed);
  useGSAP(() => {
    const content = contentRef.current;
    if (!content) return;

    const wasCollapsed = prevCollapsed.current;
    prevCollapsed.current = isCollapsed;

    if (wasCollapsed && !isCollapsed) {
      // Expanded: measure natural height, animate from 0 to full
      content.style.height = 'auto';
      const targetHeight = content.offsetHeight;
      content.style.height = '0px';
      // Force reflow so the browser registers the 0-height state
      void content.offsetHeight;
      gsap.to(content, {
        height: targetHeight,
        opacity: 1,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          content.style.height = 'auto';
        },
      });
    } else if (!wasCollapsed && isCollapsed) {
      // Collapsed: animate from current height to 0
      gsap.to(content, {
        height: 0,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        overwrite: 'auto',
      });
    }
  }, { dependencies: [isCollapsed] });

  return (
    <div data-term-group {...stylex.props(styles.termGroup)}>
      <div {...stylex.props(styles.termHeader)}>
        <button
          type="button"
          {...stylex.props(styles.termHeaderToggle)}
          onClick={onToggleCollapsed}
          aria-expanded={!isCollapsed}
        >
          <ChevronDown
            size={16}
            {...stylex.props(styles.chevron, isCollapsed && styles.chevronCollapsed)}
          />
          <span {...stylex.props(styles.termTitle)}>{term.title}</span>
          <span {...stylex.props(styles.termCount)}>
            {term.materials.length} materials · {termQuizIds.length} quizzes
          </span>
        </button>

        {termQuizIds.length > 0 && (
          <button
            type="button"
            {...stylex.props(styles.actionPill, allTermSelected && styles.actionPillActive)}
            onClick={() => onToggleTerm(termQuizIds)}
          >
            {allTermSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      <div ref={contentRef} {...stylex.props(styles.contentBody)}>
        {term.materials.map((material) => (
          <MaterialNode
            key={material.id}
            material={material}
            selectedQuizIds={selectedQuizIds}
            onToggleQuiz={onToggleQuiz}
            onToggleMaterial={onToggleMaterial}
          />
        ))}
      </div>
    </div>
  );
}

// ── Action bar: selection count + start buttons ───────────────────
function QuizExplorerActionBar({
  totalSelectedQuizzes,
  totalSelectedQuestions,
  selectedQuizIds,
  onStartSingleQuiz,
  onStartUnifiedQuiz,
}: {
  totalSelectedQuizzes: number;
  totalSelectedQuestions: number;
  selectedQuizIds: Set<string>;
  onStartSingleQuiz: (quizId: string) => void;
  onStartUnifiedQuiz: (quizIds: string[]) => void;
}) {
  const actionBarRef = useRef<HTMLDivElement>(null);

  // ── Entrance slide-up animation ────────────────────────────
  const prevSelectedCount = useRef(0);
  useGSAP(() => {
    if (!actionBarRef.current) return;
    const justAppeared = prevSelectedCount.current === 0 && totalSelectedQuizzes > 0;
    prevSelectedCount.current = totalSelectedQuizzes;
    if (justAppeared) {
      gsap.fromTo(
        actionBarRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'back.out(1.4)', overwrite: 'auto' },
      );
    }
  }, { dependencies: [totalSelectedQuizzes] });

  return (
    <div ref={actionBarRef} {...stylex.props(styles.actionBar)}>
      <span {...stylex.props(styles.selectionCount)}>
        {totalSelectedQuizzes > 0
          ? `${totalSelectedQuizzes} quiz${totalSelectedQuizzes !== 1 ? 'zes' : ''} · ${totalSelectedQuestions} question${totalSelectedQuestions !== 1 ? 's' : ''} selected`
          : 'Select quizzes to begin'}
      </span>
      <div {...stylex.props(styles.actionButtons)}>
        {totalSelectedQuizzes === 1 && (
          <Button
            label="Start quiz"
            icon={<BrainCircuit size={14} />}
            onClick={() => onStartSingleQuiz(Array.from(selectedQuizIds)[0])}
          >
            Start Quiz
          </Button>
        )}
        {totalSelectedQuizzes > 1 && (
          <Button
            label="Start unified quiz"
            icon={<BrainCircuit size={14} />}
            onClick={() => onStartUnifiedQuiz(Array.from(selectedQuizIds))}
          >
            Start Unified Quiz ({totalSelectedQuizzes} quizzes)
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Parent orchestrator ───────────────────────────────────────────
export function SubjectQuizExplorer({
  tree,
  selection,
  isLoading = false,
  onStartSingleQuiz,
  onStartUnifiedQuiz,
}: SubjectQuizExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 200);
  const [activeTermFilter, setActiveTermFilter] = useState<string | null>(null);
  const [collapsedTermIds, setCollapsedTermIds] = useState<Set<string>>(new Set());

  const {
    selectedQuizIds,
    totalSelectedQuizzes,
    totalSelectedQuestions,
    toggleQuiz,
    toggleMaterial,
    toggleTerm,
    toggleAll,
  } = selection;

  const toggleCollapsed = (termId: string) => {
    setCollapsedTermIds((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) {
        next.delete(termId);
      } else {
        next.add(termId);
      }
      return next;
    });
  };

  // Extract available terms for the filter bar
  const availableTerms = useMemo(
    () => tree.map((t) => ({ id: t.id, title: t.title })),
    [tree],
  );

  // First: filter tree by selected term
  const termFilteredTree = useMemo(() => {
    if (!activeTermFilter) return tree;
    return tree.filter((t) => t.id === activeTermFilter);
  }, [tree, activeTermFilter]);

  // Second: filter by search query (debounced)
  const filteredTree = useMemo(() => {
    if (!debouncedSearch.trim()) return termFilteredTree;
    const q = debouncedSearch.toLowerCase();

    return termFilteredTree.flatMap((term) => {
      const termMatch = term.title.toLowerCase().includes(q);

      const filteredMaterials = term.materials.flatMap((material) => {
        const materialMatch = material.title.toLowerCase().includes(q);
        const quizzes = termMatch || materialMatch
          ? material.quizzes
          : material.quizzes.filter((quiz) => quiz.title.toLowerCase().includes(q));

        if (termMatch || materialMatch || quizzes.length > 0) {
          return [{ ...material, quizzes }];
        }
        return [];
      });

      if (filteredMaterials.length > 0) {
        return [{ ...term, materials: filteredMaterials }];
      }
      return [];
    });
  }, [termFilteredTree, debouncedSearch]);

  const allQuizIds = useMemo(
    () => filteredTree.flatMap((t) => t.materials.flatMap((m) => m.quizzes.map((q) => q.id))),
    [filteredTree],
  );

  // ── Staggered term group entrance on tree load / filter change ──
  useGSAP(() => {
    if (!containerRef.current || isLoading || tree.length === 0) return;
    const termGroups = containerRef.current.querySelectorAll<HTMLElement>('[data-term-group]');
    if (termGroups.length === 0) return;
    gsap.fromTo(
      termGroups,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, stagger: 0.05, duration: 0.28, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { dependencies: [filteredTree, isLoading] });

  if (isLoading) {
    return (
      <div {...stylex.props(styles.container)}>
        <div {...stylex.props(styles.skeleton)}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} {...stylex.props(styles.skeletonItem)} />
          ))}
        </div>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div {...stylex.props(styles.container)}>
        <EmptyState
          icon={<BrainCircuit size={28} />}
          title="No quizzes yet"
          description="No quizzes are available for this subject yet. Create quizzes from material workspaces to get started."
          headingLevel="h3"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} {...stylex.props(styles.container)}>
      <QuizExplorerToolbar
        availableTerms={availableTerms}
        activeTermFilter={activeTermFilter}
        onTermFilterChange={setActiveTermFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        allQuizIds={allQuizIds}
        selectedQuizIds={selectedQuizIds}
        onToggleAll={toggleAll}
      />

      {filteredTree.map((term) => (
        <TermAccordionGroup
          key={term.id}
          term={term}
          isCollapsed={collapsedTermIds.has(term.id)}
          onToggleCollapsed={() => toggleCollapsed(term.id)}
          selectedQuizIds={selectedQuizIds}
          onToggleTerm={toggleTerm}
          onToggleQuiz={toggleQuiz}
          onToggleMaterial={toggleMaterial}
        />
      ))}

      {filteredTree.length === 0 && searchQuery && (
        <EmptyState
          icon={<Search size={24} />}
          iconVariant="muted"
          title="No quizzes found"
          description={`No quizzes match \u201c${searchQuery}\u201d.`}
          headingLevel="h3"
          action={
            <Button
              label="Clear search"
              variant="secondary"
              onClick={() => setSearchQuery('')}
            >
              Clear search
            </Button>
          }
        />
      )}

      {filteredTree.length > 0 && (
        <QuizExplorerActionBar
          totalSelectedQuizzes={totalSelectedQuizzes}
          totalSelectedQuestions={totalSelectedQuestions}
          selectedQuizIds={selectedQuizIds}
          onStartSingleQuiz={onStartSingleQuiz}
          onStartUnifiedQuiz={onStartUnifiedQuiz}
        />
      )}
    </div>
  );
}

SubjectQuizExplorer.displayName = 'SubjectQuizExplorer';
