import { useState, useMemo, useRef, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { useSubject } from '../../shared/hooks/useSubject';
import { useTerms } from '../../shared/hooks/useTerms';
import { useTabKeyboardNavigation } from '../../shared/hooks/useTabKeyboardNavigation';
import { useLibrary } from '../library/hooks/useLibrary';
import { Page } from '../../shared/ui/Page';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import MaterialsTab from './components/MaterialsTab';
import SubjectQuizTab from './components/SubjectQuizTab';

const styles = stylex.create({
  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    borderBottom: '1px solid #e5e4e7',
    paddingBottom: 0,
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: '#6b6375',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    transition: 'color 0.15s ease, border-color 0.15s ease',
    ':hover': {
      color: '#3d3548',
    },
  },
  tabActive: {
    color: '#6366f1',
    borderBottomColor: '#6366f1',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: '#6b6375',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
});

export type SubjectTab = 'materials' | 'quiz';

// Hoisted to module scope for a stable reference across renders
const SUBJECT_TABS: { key: SubjectTab; label: string; icon: typeof BookOpen }[] = [
    { key: 'materials', label: 'Materials', icon: BookOpen },
    { key: 'quiz', label: 'Quiz', icon: BrainCircuit },
];

interface SubjectWorkspaceProps {
  subjectId: string;
  activeTab: SubjectTab;
  onNavigate: (route: AppRoute) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export default function SubjectWorkspace({
  subjectId,
  activeTab: initialTab,
  onNavigate,
  onStartQuiz,
}: SubjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SubjectTab>(initialTab);
  const { subject, isLoading: subjectLoading } = useSubject(subjectId);
  const { terms, isLoading: termsLoading } = useTerms(subjectId);
  const { materials } = useLibrary();

  // Define callbacks before hooks that consume them (avoids temporal dead zone)
  const handleTabChange = useCallback((tab: SubjectTab) => {
    setActiveTab(tab);
    onNavigate({ kind: 'subject', subjectId, activeTab: tab });
  }, [setActiveTab, onNavigate, subjectId]);

  // Hooks must be called before any early returns (rules-of-hooks)
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabKeyboard = useTabKeyboardNavigation({
    tabs: ['materials', 'quiz'] as const,
    activeTab,
    onTabChange: handleTabChange,
  });

  const subjectMaterials = useMemo(
    () => materials.filter((m) => m.subjectId === subjectId),
    [materials, subjectId],
  );

  const handleOpenMaterial = (materialId: string) => {
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, subjectId, activeTab: 'read' });
  };

  const handleManageMaterial = (materialId: string) => {
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'manage' });
  };

  const handleStartUnifiedQuiz = (materialIds: string[]) => {
    onNavigate({
      kind: 'quiz-session',
      quizId: `unified-${subjectId}-${Date.now()}`,
      materialIds,
      subjectId,
      returnTo: { kind: 'subject', subjectId, activeTab: 'quiz' },
    });
  };

  if (subjectLoading || termsLoading) {
    return (
      <Page title="Subject">
        <div {...stylex.props(styles.loadingContainer)}>
          <WorkspaceSkeleton />
        </div>
      </Page>
    );
  }

  if (!subject) {
    return (
      <Page title="Subject not found">
        <div {...stylex.props(styles.loading)}>This subject could not be found.</div>
      </Page>
    );
  }

  return (
    <Page
      title={subject.title}
      description={subject.description ?? undefined}
    >
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Subject tabs"
        onKeyDown={tabKeyboard.handleKeyDown}
        {...stylex.props(styles.tabBar)}
      >
        {SUBJECT_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`subject-panel-${key}`}
            tabIndex={activeTab === key ? 0 : -1}
            onClick={() => handleTabChange(key)}
            {...stylex.props(styles.tab, activeTab === key && styles.tabActive)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`subject-panel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {activeTab === 'materials' && (
          <MaterialsTab
            materials={subjectMaterials}
            terms={terms}
            onOpen={handleOpenMaterial}
            onStartQuiz={(r) => onStartQuiz({ materialId: r.materialId, source: r.source as 'library' | 'reader' })}
            onManage={handleManageMaterial}
          />
        )}

        {activeTab === 'quiz' && (
          <SubjectQuizTab
            materials={subjectMaterials}
            terms={terms}
            onStartUnifiedQuiz={handleStartUnifiedQuiz}
          />
        )}
      </div>
    </Page>
  );
}
