import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { useMaterial } from '../../shared/hooks/useMaterial';
import { useSubject } from '../../shared/hooks/useSubject';
import { useTerm } from '../../shared/hooks/useTerm';
import { Page } from '../../shared/ui/Page';
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

  const handleTabChange = (tab: MaterialTab) => {
    setActiveTab(tab);
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: tab, subjectId });
  };

  if (isLoading) {
    return (
      <Page title="Loading…">
        <div {...stylex.props(styles.loading)}>Loading material…</div>
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
      <div {...stylex.props(styles.tabBar)}>
        <button
          type="button"
          onClick={() => handleTabChange('read')}
          {...stylex.props(styles.tab, activeTab === 'read' && styles.tabActive)}
        >
          <BookOpen size={15} />
          Read
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('quiz')}
          {...stylex.props(styles.tab, activeTab === 'quiz' && styles.tabActive)}
        >
          <BrainCircuit size={15} />
          Quiz
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('manage')}
          {...stylex.props(styles.tab, activeTab === 'manage' && styles.tabActive)}
        >
          <ClipboardList size={15} />
          Manage
        </button>
      </div>

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
    </Page>
  );
}
