import { useState, useMemo, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, Layers, Plus } from 'lucide-react';
import type { AppRoute } from '../../app/layouts/AppShell';
import type { QuizLaunchRequest } from '../quiz';
import type { StudyMaterial } from '../../domain/library';
import { useSubject } from './hooks/queries/useSubject';
import { useSubjects } from './hooks/queries/useSubjects';
import { useTerms } from './hooks/queries/useTerms';
import { useLibrary } from '../library/hooks/queries/useLibrary';
import { useCreateMaterial } from '../library/hooks/mutations/useCreateMaterial';
import { useEditMaterial } from '../library/hooks/mutations/useEditMaterial';
import { useDeleteMaterial } from '../library/hooks/mutations/useDeleteMaterial';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button/Button';
import { Breadcrumbs } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { AnimatedTabPanel } from '../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import EditMaterialModal from '../library/components/EditMaterialModal';
import DeleteConfirmationModal from '../library/components/DeleteConfirmationModal';
import MaterialsTab from './components/MaterialsTab';
import SubjectQuizTab from './components/SubjectQuizTab';
import SubjectTermsTab from './components/SubjectTermsTab';

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

export type SubjectTab = 'materials' | 'quiz' | 'terms';

// Hoisted to module scope for a stable reference across renders
const SUBJECT_TABS: { key: SubjectTab; label: string; icon: typeof BookOpen }[] = [
  { key: 'materials', label: 'Materials', icon: BookOpen },
  { key: 'quiz', label: 'Quiz', icon: BrainCircuit },
  { key: 'terms', label: 'Terms', icon: Layers },
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
  const { subjects } = useSubjects();
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

  const createMaterialMutation = useCreateMaterial();
  const editMutation = useEditMaterial();
  const deleteMutation = useDeleteMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const handleAddMaterial = useCallback(() => {
    const title = `Study Material ${materials.length + 1}`;
    createMaterialMutation.mutate({ title, subjectId });
  }, [materials.length, createMaterialMutation, subjectId]);

  const handleEditTrigger = useCallback((material: StudyMaterial) => {
    setEditTarget(material);
  }, []);

  const handleEditSave = useCallback(
    (title: string, description: string, subjectId?: string | null, termId?: string | null) => {
      if (!editTarget) return;
      editMutation.mutate({ id: editTarget.id, input: { title, description, subjectId, termId } });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
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

  const handleStartQuiz = useCallback(
    (request: QuizLaunchRequest) => {
      if (request.type === 'quiz') {
        // Single quiz: navigate to quiz session
        onNavigate({
          kind: 'quiz-session',
          quizId: request.quizId ?? '',
          materialIds: [],
          subjectId,
          returnTo: { kind: 'subject', subjectId, activeTab: 'quiz' },
        });
      } else {
        // Multiple quizzes (unified): navigate with all quiz IDs
        onNavigate({
          kind: 'quiz-session',
          quizId: `unified-${subjectId}-${Date.now()}`,
          materialIds: [],
          quizIds: request.quizIds,
          subjectId,
          returnTo: { kind: 'subject', subjectId, activeTab: 'quiz' },
        });
      }
    },
    [onNavigate, subjectId],
  );

  const handleMaterialsTabQuiz = useCallback(
    (r: { materialId: string; source: string; subjectId?: string }) => {
      onStartQuiz({ type: 'quiz', quizId: r.materialId, materialId: r.materialId, source: r.source as 'library' | 'reader', subjectId: r.subjectId });
    },
    [onStartQuiz],
  );

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
      actions={
        activeTab === 'materials' ? (
          <Button
            label="Add Material"
            variant="primary"
            icon={<Plus size={18} />}
            onClick={handleAddMaterial}
          >
            Add Material
          </Button>
        ) : undefined
      }
    >
      <TabList value={activeTab} onChange={handleTabChange} layout="fill" hasDivider aria-label="Subject tabs">
        {SUBJECT_TABS.map(({ key, label, icon: Icon }) => (
          <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
        ))}
      </TabList>

      <AnimatedTabPanel activeKey={activeTab}>
        {activeTab === 'materials' && (
          <MaterialsTab
            materials={subjectMaterials}
            terms={terms}
            onOpen={handleOpenMaterial}
            onStartQuiz={handleMaterialsTabQuiz}
            onManage={handleManageMaterial}
            onEdit={handleEditTrigger}
            onDelete={handleDeleteTrigger}
            onAddMaterial={handleAddMaterial}
            isAddingMaterial={createMaterialMutation.isPending}
          />
        )}

        {activeTab === 'quiz' && (
          <SubjectQuizTab
            subjectId={subjectId}
            onStartQuiz={handleStartQuiz}
          />
        )}

        {activeTab === 'terms' && (
          <SubjectTermsTab subjectId={subjectId} />
        )}
      </AnimatedTabPanel>

      {/* Modals */}
      {editTarget && (
        <EditMaterialModal
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          initialSubjectId={editTarget.subjectId}
          initialTermId={editTarget.termId}
          subjects={subjects}
          onSave={handleEditSave}
          onClose={handleEditClose}
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
