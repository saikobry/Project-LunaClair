import { useState, useMemo, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import type { StudyMaterial } from '../../domain/library';
import { useSubject } from '../../shared/hooks/useSubject';
import { useTerms } from '../../shared/hooks/useTerms';
import { useLibrary } from '../library/hooks/useLibrary';
import { useRenameMaterial } from '../library/hooks/mutations/useRenameMaterial';
import { useDeleteMaterial } from '../library/hooks/mutations/useDeleteMaterial';
import { Page } from '../../shared/ui/Page';
import { Breadcrumbs } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import RenameMaterialModal from '../library/components/RenameMaterialModal';
import DeleteConfirmationModal from '../library/components/DeleteConfirmationModal';
import MaterialsTab from './components/MaterialsTab';
import SubjectQuizTab from './components/SubjectQuizTab';

const styles = stylex.create({
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
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
  onOpenMaterial: (materialId: string, subjectId?: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export default function SubjectWorkspace({
  subjectId,
  activeTab: initialTab,
  onNavigate,
  onOpenMaterial,
  onStartQuiz,
}: SubjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SubjectTab>(initialTab);
  const { subject, isLoading: subjectLoading } = useSubject(subjectId);
  const { terms, isLoading: termsLoading } = useTerms(subjectId);
  const { materials } = useLibrary();

  // Define callbacks before hooks that consume them (avoids temporal dead zone)
  const handleTabChange = useCallback((tab: string) => {
    const subjectTab = tab as SubjectTab;
    setActiveTab(subjectTab);
    onNavigate({ kind: 'subject', subjectId, activeTab: subjectTab });
  }, [setActiveTab, onNavigate, subjectId]);

  const subjectMaterials = useMemo(
    () => materials.filter((m) => m.subjectId === subjectId),
    [materials, subjectId],
  );

  const handleOpenMaterial = (materialId: string) => {
    onOpenMaterial(materialId, subjectId);
  };

  const handleManageMaterial = (materialId: string, subjectId?: string) => {
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, subjectId, activeTab: 'manage' });
  };

  const renameMutation = useRenameMaterial();
  const deleteMutation = useDeleteMaterial();

  const [renameTarget, setRenameTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const handleRenameTrigger = useCallback((material: StudyMaterial) => {
    setRenameTarget(material);
  }, []);

  const handleRenameSave = useCallback(
    (title: string, description: string) => {
      if (!renameTarget) return;
      renameMutation.mutate({ id: renameTarget.id, input: { title, description } });
      setRenameTarget(null);
    },
    [renameTarget, renameMutation],
  );

  const handleRenameClose = useCallback(() => {
    setRenameTarget(null);
  }, []);

  const handleDeleteTrigger = useCallback((material: StudyMaterial) => {
    setDeleteTarget(material);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const handleDeleteClose = useCallback(() => {
    setDeleteTarget(null);
  }, []);

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
      breadcrumb={
        <Breadcrumbs
          items={[
            { label: 'Library', onClick: () => onNavigate({ kind: 'library' }) },
            { label: subject.title },
          ]}
        />
      }
    >
      <TabList value={activeTab} onChange={handleTabChange} layout="fill" hasDivider aria-label="Subject tabs">
        {SUBJECT_TABS.map(({ key, label, icon: Icon }) => (
          <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
        ))}
      </TabList>

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
            onStartQuiz={(r) => onStartQuiz({ materialId: r.materialId, source: r.source as 'library' | 'reader', subjectId: r.subjectId })}
            onManage={handleManageMaterial}
            onRename={handleRenameTrigger}
            onDelete={handleDeleteTrigger}
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

      {/* Modals */}
      {renameTarget && (
        <RenameMaterialModal
          initialTitle={renameTarget.title}
          initialDescription={renameTarget.description ?? ''}
          onSave={handleRenameSave}
          onClose={handleRenameClose}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          title={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onClose={handleDeleteClose}
        />
      )}
    </Page>
  );
}
