import { useState, useCallback, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, ClipboardList } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import { useMaterial } from '../../shared/hooks/useMaterial';
import { useSubject } from '../../shared/hooks/useSubject';
import { useTerm } from '../../shared/hooks/useTerm';
import { Page } from '../../shared/ui/Page';
import { Breadcrumbs, type BreadcrumbItem } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import ReaderScreen from '../reader/ReaderScreen';
import QuizScreen from '../quiz/QuizScreen';
import QuizManagementScreen from '../quiz-management/QuizManagementScreen';

const styles = stylex.create({
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
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
}

export default function MaterialWorkspace({
  materialId,
  activeTab: initialTab,
  subjectId,
  onNavigate,
}: MaterialWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MaterialTab>(initialTab);
  const { material, isLoading } = useMaterial(materialId);
  const { subject } = useSubject(subjectId || material?.subjectId);
  const { term } = useTerm(material?.termId);

  // Define callbacks before hooks that consume them (avoids temporal dead zone)
  const handleTabChange = useCallback((tab: string) => {
    const materialTab = tab as MaterialTab;
    setActiveTab(materialTab);
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: materialTab, subjectId });
  }, [setActiveTab, onNavigate, materialId, subjectId]);

  const breadcrumbItems = useMemo(() => {
    if (!material) return [];
    const items: BreadcrumbItem[] = [
      { label: 'Library', onClick: () => onNavigate({ kind: 'library' }) },
    ];
    if (subject) {
      items.push({
        label: subject.title,
        onClick: () => onNavigate({ kind: 'subject', subjectId: subject.id, activeTab: 'materials' }),
      });
    }
    if (term) {
      items.push({ label: term.title });
    }
    items.push({ label: material.title });
    return items;
  }, [material, subject, term, onNavigate]);

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

  return (
    <Page
      title={material.title}
      breadcrumb={<Breadcrumbs items={breadcrumbItems} />}
    >
      <TabList value={activeTab} onChange={handleTabChange} layout="fill" hasDivider aria-label="Material tabs">
        {MATERIAL_TABS.map(({ key, label, icon: Icon }) => (
          <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
        ))}
      </TabList>

      <div
        role="tabpanel"
        id={`material-panel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {activeTab === 'read' && (
          <ReaderScreen
            materialId={materialId}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizScreen
            quizId=""
            materialIds={[materialId]}
            onExit={() => onNavigate({ kind: 'library' })}
            embedded
          />
        )}
        {activeTab === 'manage' && (
          <QuizManagementScreen
            materialId={materialId}
          />
        )}
      </div>
    </Page>
  );
}
