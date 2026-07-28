import { useState, useRef, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { useMaterial } from '../../shared/hooks/useMaterial';
import { useSubject } from '../../shared/hooks/useSubject';
import { useTerm } from '../../shared/hooks/useTerm';
import { useTabKeyboardNavigation } from '../../shared/hooks/useTabKeyboardNavigation';
import { Page } from '../../shared/ui/Page';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import ReaderScreen from '../reader/ReaderScreen';
import QuizScreen from '../quiz/QuizScreen';
import QuizManagementScreen from '../quiz-management/QuizManagementScreen';

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
});

export type MaterialTab = 'read' | 'quiz' | 'manage';

// Hoisted to module scope for a stable reference across renders
const MATERIAL_TABS: { key: MaterialTab; label: string; icon: typeof BookOpen }[] = [
    { key: 'read', label: 'Read', icon: BookOpen },
    { key: 'quiz', label: 'Quiz', icon: BrainCircuit },
    { key: 'manage', label: 'Manage', icon: ClipboardList },
];

interface MaterialWorkspaceProps {
  materialId: string;
  activeTab: MaterialTab;
  subjectId?: string;
  onNavigate: (route: AppRoute) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export default function MaterialWorkspace({
  materialId,
  activeTab: initialTab,
  subjectId,
  onNavigate,
  onStartQuiz,
}: MaterialWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MaterialTab>(initialTab);
  const { material, isLoading } = useMaterial(materialId);
  const { subject } = useSubject(subjectId || material?.subjectId);
  const { term } = useTerm(material?.termId);

  // Define callbacks before hooks that consume them (avoids temporal dead zone)
  const handleTabChange = useCallback((tab: MaterialTab) => {
    setActiveTab(tab);
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: tab, subjectId });
  }, [setActiveTab, onNavigate, materialId, subjectId]);

  // Hooks must be called before any early returns (rules-of-hooks)
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabKeyboard = useTabKeyboardNavigation({
    tabs: ['read', 'quiz', 'manage'] as const,
    activeTab,
    onTabChange: handleTabChange,
  });

  if (isLoading) {
    return (
      <Page title="Material">
        <div {...stylex.props(styles.loading)}>
          <WorkspaceSkeleton />
        </div>
      </Page>
    );
  }

  if (!material) {
    return (
      <Page title="Material not found">
        <div {...stylex.props(styles.loading)}>This material could not be found.</div>
      </Page>
    );
  }

  const subtitle = [
    subject?.title,
    term?.title,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <Page
      title={material.title}
      description={subtitle || undefined}
    >
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Material tabs"
        onKeyDown={tabKeyboard.handleKeyDown}
        {...stylex.props(styles.tabBar)}
      >
        {MATERIAL_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`material-panel-${key}`}
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
        id={`material-panel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {activeTab === 'read' && (
          <ReaderScreen
            materialId={materialId}
            onBackToLibrary={() => onNavigate({ kind: 'library' })}
            onStartQuiz={onStartQuiz}
            onManageQuiz={() => handleTabChange('manage')}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizScreen
            quizId=""
            materialIds={[materialId]}
            onExit={() => onNavigate({ kind: 'library' })}
          />
        )}
        {activeTab === 'manage' && (
          <QuizManagementScreen
            materialId={materialId}
            onBack={() => handleTabChange('read')}
          />
        )}
      </div>
    </Page>
  );
}
