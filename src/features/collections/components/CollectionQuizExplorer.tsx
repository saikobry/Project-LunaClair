import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronRight, ListChecks, Play, Search, X, Zap } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { QuizLaunchRequest } from '../../quiz/types/quizFeature.types';
import { useCollectionQuizTree } from '../hooks/queries/useCollectionQuizTree';
import { useFocusMode } from '../../../app/providers/FocusModeContext';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { Input } from '../../../shared/ui/Input/Input';
import { Checkbox } from '../../../shared/ui/Checkbox/Checkbox';
import { Button } from '../../../shared/ui/Button/Button';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { WorkspaceSkeleton } from '../../../shared/ui/Skeleton/Skeleton';

export interface CollectionQuizExplorerProps {
  materials: StudyMaterial[];
  collectionId: string;
  onStartQuiz?: (request: QuizLaunchRequest) => void;
}

const desktop = '@media (min-width: 1024px)';
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';
/** Narrow phones: the action bar stacks info above full-width actions. */
const narrowBar = '@media (max-width: 640px)';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  containerWithBar: {
    // Reserve scroll room for the fixed bar: stacked bar above the mobile
    // dock needs the most, single-row tablet/desktop bars the least.
    paddingBottom: 224,
    '@media (min-width: 641px) and (max-width: 768px)': {
      paddingBottom: 152,
    },
    [tablet]: {
      paddingBottom: 96,
    },
    [desktop]: {
      paddingBottom: 96,
    },
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchSlot: {
    flex: 1,
    minWidth: 220,
  },
  selectAllRow: {
    display: 'flex',
    alignItems: 'center',
  },
  toolbarSummary: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  group: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, #e5e7eb)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    width: '100%',
    boxSizing: 'border-box',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  quizList: {
    display: 'flex',
    flexDirection: 'column',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-border, #e5e7eb)',
  },
  quizRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px 8px 36px',
  },
  quizTitleSlot: {
    flex: 1,
    minWidth: 0,
  },
  foundationsBadge: {
    fontSize: 9,
    color: '#92b5a5',
    backgroundColor: 'rgba(143, 197, 172, 0.08)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(143, 197, 172, 0.2)',
  },
  applyBadge: {
    fontSize: 9,
    color: '#c2a784',
    backgroundColor: 'rgba(201, 160, 108, 0.08)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(201, 160, 108, 0.2)',
  },
  actionBar: {
    position: 'fixed',
    // Mobile (floating bottom dock): full-bleed gutters, parked above the
    // 60px dock + 12px dock offset + 16px gap.
    left: 16,
    right: 16,
    bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
    zIndex: 30,
    maxWidth: 920,
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 20,
    // Token-based glass surface (AppHeader capsule recipe) so the bar tracks
    // light/dark themes instead of a hardcoded dark palette.
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 0 24px rgba(167, 139, 250, 0.08)',
    // Glide with the sidebar: the rail animates width 240<->0 over 0.35s
    // power2.inOut on Focus toggle — matching duration/easing here keeps the
    // bar glued to the content region instead of jumping between offsets.
    transitionProperty: 'left, right, bottom',
    transitionDuration: '0.35s',
    transitionTimingFunction: 'cubic-bezier(0.36, 0, 0.64, 1)',
    [tablet]: {
      // Tablet (floating 60px rail at left:16): clear rail + gutter + gap.
      left: 88,
      right: 16,
      bottom: 20,
    },
    [desktop]: {
      // Desktop (240px sidebar slot): center within the content region.
      left: 256,
      right: 16,
      bottom: 20,
    },
    [narrowBar]: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  },
  actionBarFocus: {
    [desktop]: {
      // Focus Mode collapses the rail slot to 0 — reclaim the sidebar offset.
      left: 16,
    },
  },
  barInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  barIconMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  barText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  barTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  barSubtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  barActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    [narrowBar]: {
      width: '100%',
    },
  },
  launchSlot: {
    display: 'flex',
    flexShrink: 0,
    [narrowBar]: {
      flex: 1,
      minWidth: 0,
    },
  },
});

function toggleIdInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function CollectionQuizExplorer({
  materials,
  collectionId,
  onStartQuiz,
}: CollectionQuizExplorerProps) {
  const { tree, isLoading } = useCollectionQuizTree(collectionId, materials);
  const { isFocusMode } = useFocusMode();
  const [search, setSearch] = useState('');
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(() => new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const debouncedSearch = useDebounce(search, 200);

  const filteredTree = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (query.length === 0) return tree;
    return tree.flatMap((group) => {
      if (group.materialTitle.toLowerCase().includes(query)) return [group];
      const quizzes = group.quizzes.filter((quiz) => quiz.title.toLowerCase().includes(query));
      if (quizzes.length === 0) return [];
      return [{ ...group, quizzes }];
    });
  }, [tree, debouncedSearch]);

  const totalQuizCount = useMemo(
    () => tree.reduce((sum, group) => sum + group.quizzes.length, 0),
    [tree],
  );

  const totalQuestions = useMemo(
    () =>
      tree.reduce(
        (sum, group) => sum + group.quizzes.reduce((inner, quiz) => inner + quiz.questionCount, 0),
        0,
      ),
    [tree],
  );

  const questionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of tree) {
      for (const quiz of group.quizzes) {
        counts.set(quiz.id, quiz.questionCount);
      }
    }
    return counts;
  }, [tree]);

  const quizTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const group of tree) {
      for (const quiz of group.quizzes) {
        titles.set(quiz.id, quiz.title);
      }
    }
    return titles;
  }, [tree]);

  // Quiz rows carry no difficulty signal, so badges alternate deterministically
  // in flattened tree order (stable across renders and searches).
  const orderedQuizIds = useMemo(
    () => tree.flatMap((group) => group.quizzes.map((quiz) => quiz.id)),
    [tree],
  );
  const difficultyOf = (quizId: string): 'Foundations' | 'Apply' =>
    orderedQuizIds.indexOf(quizId) % 2 === 0 ? 'Foundations' : 'Apply';

  const visibleQuizIds = useMemo(
    () => filteredTree.flatMap((group) => group.quizzes.map((quiz) => quiz.id)),
    [filteredTree],
  );

  const allVisibleSelected =
    visibleQuizIds.length > 0 && visibleQuizIds.every((id) => selectedQuizIds.has(id));

  const selectedCount = selectedQuizIds.size;
  const selectedQuestions = useMemo(() => {
    let total = 0;
    for (const id of selectedQuizIds) {
      total += questionCounts.get(id) ?? 0;
    }
    return total;
  }, [questionCounts, selectedQuizIds]);

  const singleSelectedTitle =
    selectedCount === 1 ? (quizTitles.get(Array.from(selectedQuizIds)[0]) ?? 'Quiz') : null;

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (totalQuizCount === 0) {
    return (
      <EmptyState
        icon={<ListChecks size={28} />}
        title="No quizzes available yet in this collection."
        description="Quizzes added to materials in this collection will appear here for unified practice."
        headingLevel="h3"
      />
    );
  }

  const handleToggleMaterial = (quizIds: string[], checked: boolean) => {
    setSelectedQuizIds((prev) => {
      const next = new Set(prev);
      for (const id of quizIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    handleToggleMaterial(visibleQuizIds, checked);
  };

  const handleClearSelection = () => {
    setSelectedQuizIds(new Set());
  };

  const handleStart = () => {
    if (selectedQuizIds.size === 0) return;
    const ids = Array.from(selectedQuizIds);
    if (ids.length === 1) {
      onStartQuiz?.({ type: 'quiz', quizId: ids[0], source: 'library' });
    } else {
      onStartQuiz?.({ type: 'quizzes', quizIds: ids, source: 'library' });
    }
  };

  const launchLabel =
    selectedCount === 1 && singleSelectedTitle
      ? `Start Quiz: ${singleSelectedTitle}`
      : `Start Unified Quiz (${selectedCount} quizzes · ${selectedQuestions} questions)`;

  return (
    <div {...stylex.props(styles.container, selectedCount > 0 && styles.containerWithBar)}>
      <div {...stylex.props(styles.toolbar)}>
        <div {...stylex.props(styles.searchSlot)}>
          <Input
            label="Search quizzes"
            labelHidden
            value={search}
            onChange={(value) => setSearch(value)}
            placeholder="Search materials and quizzes…"
            startIcon={<Search size={15} />}
            clearable
          />
        </div>
        <div {...stylex.props(styles.selectAllRow)}>
          <Checkbox
            label={`Select All (${totalQuizCount})`}
            isChecked={allVisibleSelected}
            onChange={handleSelectAll}
          />
        </div>
        <span {...stylex.props(styles.toolbarSummary)}>
          {totalQuizCount} quizzes · {totalQuestions} questions
        </span>
      </div>

      {filteredTree.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="No quizzes match your search."
          description="Try a different keyword to find quizzes in this collection."
          headingLevel="h3"
        />
      ) : (
        filteredTree.map((group) => {
          const quizIds = group.quizzes.map((quiz) => quiz.id);
          const allChecked = quizIds.length > 0 && quizIds.every((id) => selectedQuizIds.has(id));
          const collapsed = collapsedIds.has(group.materialId);
          return (
            <div key={group.materialId} {...stylex.props(styles.group)}>
              <div {...stylex.props(styles.groupHeader)}>
                <Button
                  label={collapsed ? `Expand ${group.materialTitle}` : `Collapse ${group.materialTitle}`}
                  variant="ghost"
                  isIconOnly
                  icon={collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  onClick={() => setCollapsedIds((prev) => toggleIdInSet(prev, group.materialId))}
                >
                  {undefined}
                </Button>
                <Checkbox
                  label={`Select all quizzes in ${group.materialTitle}`}
                  isLabelHidden
                  isChecked={allChecked}
                  onChange={(checked) => handleToggleMaterial(quizIds, checked)}
                />
                <span {...stylex.props(styles.groupTitle)}>{group.materialTitle}</span>
                <Chip variant="neutral">
                  {group.quizzes.length} {group.quizzes.length === 1 ? 'quiz' : 'quizzes'}
                </Chip>
              </div>
              {!collapsed && (
                <div {...stylex.props(styles.quizList)}>
                  {group.quizzes.map((quiz) => {
                    const difficulty = difficultyOf(quiz.id);
                    return (
                      <div key={quiz.id} {...stylex.props(styles.quizRow)}>
                        <div {...stylex.props(styles.quizTitleSlot)}>
                          <Checkbox
                            label={quiz.title}
                            isChecked={selectedQuizIds.has(quiz.id)}
                            onChange={() =>
                              setSelectedQuizIds((prev) => toggleIdInSet(prev, quiz.id))
                            }
                          />
                        </div>
                        <Chip
                          variant="neutral"
                          style={
                            difficulty === 'Foundations'
                              ? styles.foundationsBadge
                              : styles.applyBadge
                          }
                        >
                          {difficulty}
                        </Chip>
                        <Chip variant="neutral">{quiz.questionCount} questions</Chip>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {selectedCount > 0 && (
        <div {...stylex.props(styles.actionBar, isFocusMode && styles.actionBarFocus)}>
          <div {...stylex.props(styles.barInfo)}>
            <span {...stylex.props(styles.barIconMark)} aria-hidden="true">
              <Zap size={18} />
            </span>
            <div {...stylex.props(styles.barText)}>
              <span {...stylex.props(styles.barTitle)}>
                {selectedCount === 1
                  ? 'A little focus goes a long way.'
                  : 'One session. Connected knowledge.'}
              </span>
              <span {...stylex.props(styles.barSubtitle)}>
                {selectedCount} selected · {selectedQuestions} questions
              </span>
            </div>
          </div>
          <div {...stylex.props(styles.barActions)}>
            <Button
              label="Clear selection"
              variant="ghost"
              isIconOnly
              icon={<X size={16} />}
              onClick={handleClearSelection}
            />
            <div {...stylex.props(styles.launchSlot)}>
              <Button label={launchLabel} variant="primary" icon={<Play size={14} />} onClick={handleStart} style={{ width: '100%' }}>
                {launchLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollectionQuizExplorer;
