import { useMemo, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronRight, ListChecks, Play, Search } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { QuizLaunchRequest } from '../../quiz/types/quizFeature.types';
import { useCollectionQuizTree } from '../hooks/queries/useCollectionQuizTree';
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

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchSlot: {
    flex: 1,
    minWidth: 220,
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
  actionBar: {
    position: 'sticky',
    bottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: '12px 16px',
    borderRadius: 12,
    backgroundColor: 'var(--color-background-elevated, #fff)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, #e5e7eb)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  },
  actionSummary: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
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

  const visibleQuizIds = useMemo(
    () => filteredTree.flatMap((group) => group.quizzes.map((quiz) => quiz.id)),
    [filteredTree],
  );

  const allVisibleSelected =
    visibleQuizIds.length > 0 && visibleQuizIds.every((id) => selectedQuizIds.has(id));

  const selectedQuestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of tree) {
      for (const quiz of group.quizzes) {
        counts.set(quiz.id, quiz.questionCount);
      }
    }
    let total = 0;
    for (const id of selectedQuizIds) {
      total += counts.get(id) ?? 0;
    }
    return total;
  }, [tree, selectedQuizIds]);

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

  const handleSelectAllToggle = () => {
    setSelectedQuizIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleQuizIds) next.delete(id);
      } else {
        for (const id of visibleQuizIds) next.add(id);
      }
      return next;
    });
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

  return (
    <div {...stylex.props(styles.container)}>
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
        <Button
          label={allVisibleSelected ? 'Deselect All' : 'Select All'}
          variant="secondary"
          onClick={handleSelectAllToggle}
        >
          {allVisibleSelected ? 'Deselect All' : 'Select All'}
        </Button>
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
                  {group.quizzes.map((quiz) => (
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
                      <Chip variant="neutral">{quiz.questionCount} questions</Chip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {selectedQuizIds.size > 0 && (
        <div {...stylex.props(styles.actionBar)}>
          <span {...stylex.props(styles.actionSummary)}>
            {selectedQuizIds.size} {selectedQuizIds.size === 1 ? 'quiz' : 'quizzes'} ·{' '}
            {selectedQuestions} questions selected
          </span>
          {selectedQuizIds.size === 1 ? (
            <Button label="Start Quiz" variant="primary" icon={<Play size={15} />} onClick={handleStart}>
              Start Quiz
            </Button>
          ) : (
            <Button
              label={`Start Unified Quiz (${selectedQuizIds.size} quizzes)`}
              variant="primary"
              icon={<Play size={15} />}
              onClick={handleStart}
            >
              Start Unified Quiz ({selectedQuizIds.size} quizzes)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default CollectionQuizExplorer;
