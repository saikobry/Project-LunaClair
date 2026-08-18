import { useState, useCallback, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, PenTool, BrainCircuit, Layers, ClipboardList, FileQuestion } from 'lucide-react';
import type { AppRoute } from './AppShell';
import { useMaterial } from '../../features/catalog/materials/hooks/queries/useMaterial';
import { useSubject } from '../../features/catalog/subjects/hooks/queries/useSubject';
import { useTerm } from '../../features/catalog/terms/hooks/queries/useTerm';
import { Page } from '../../shared/ui/Page/Page';
import { Button } from '../../shared/ui/Button/Button';
import { Breadcrumbs, type BreadcrumbItem } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { AnimatedTabPanel } from '../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import { ErrorState } from '../../shared/ui/ErrorState/ErrorState';
import ReaderScreen from '../../features/reader/ReaderScreen';
import { MaterialWriterTab } from '../../features/writer/components/MaterialWriterTab';
import QuizScreen from '../../features/quiz/QuizScreen';
import QuizManagementScreen from '../../features/quiz-management/QuizManagementScreen';
import { FlashcardScreen } from '../../features/flashcards/FlashcardScreen';

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

export type MaterialTab = 'read' | 'write' | 'quiz' | 'flashcards' | 'manage';

// Hoisted to module scope for a stable reference across renders
const MATERIAL_TABS: { key: MaterialTab; label: string; icon: typeof BookOpen }[] = [
  { key: 'read', label: 'Read', icon: BookOpen },
  { key: 'write', label: 'Write', icon: PenTool },
  { key: 'quiz', label: 'Quiz', icon: BrainCircuit },
  { key: 'flashcards', label: 'Flashcards', icon: Layers },
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
        <ErrorState
          icon={<FileQuestion size={28} />}
          title="Material could not be found"
          description="This material does not exist or may have been removed from your library."
          action={
            <Button
              label="Back to Library"
              variant="primary"
              onClick={() => onNavigate({ kind: 'library' })}
            >
              Back to Library
            </Button>
          }
        />
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

      <AnimatedTabPanel activeKey={activeTab}>
        {activeTab === 'read' && (
          <ReaderScreen
            materialId={materialId}
          />
        )}
        {activeTab === 'write' && (
          <MaterialWriterTab
            materialId={materialId}
          />
        )}
        {activeTab === 'quiz' && (
          <QuizScreen
            quizId=""
            materialIds={[materialId]}
            onExit={() => onNavigate({ kind: 'library' })}
            onOpenManagement={() => handleTabChange('manage')}
            embedded
          />
        )}
        {activeTab === 'flashcards' && (
          <FlashcardScreen
            materialId={materialId}
          />
        )}
        {activeTab === 'manage' && (
          <QuizManagementScreen
            materialId={materialId}
            onNavigate={onNavigate}
          />
        )}
      </AnimatedTabPanel>
    </Page>
  );
}

