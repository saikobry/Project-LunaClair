import { useCallback, useMemo, useRef, useEffect, useState, lazy, Suspense } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, PenTool, BrainCircuit, Layers, ClipboardList, FileQuestion, Package, Share2 } from 'lucide-react';
import type { AppRoute } from '../routing/routing';
import { useMaterial } from '../../features/catalog/materials/hooks/queries/useMaterial';
import { useSubject } from '../../features/catalog/subjects/hooks/queries/useSubject';
import { useTerm } from '../../features/catalog/terms/hooks/queries/useTerm';
import { useDocument } from '../../features/reader/hooks/useDocument';
import { useExportStudyPackage } from '../../features/package/hooks/useExportStudyPackage';
import { Page } from '../../shared/ui/Page/Page';
import { Button } from '../../shared/ui/Button/Button';
import { Breadcrumbs, type BreadcrumbItem } from '../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../shared/ui/TabList/TabList';
import { AnimatedTabPanel } from '../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
import { WorkspaceSkeleton } from '../../shared/ui/Skeleton/Skeleton';
import { ErrorState } from '../../shared/ui/ErrorState/ErrorState';
import ReaderScreen from '../../features/reader/ReaderScreen';
import { AiDrawerToggleButton } from '../../features/ai/components/AiDrawerToggleButton';
import { extractSectionContext } from '../../domain/ai/extractSectionContext';
import type { SelectionContext } from '../../features/ai/components/AiChatDrawer';

// Lazy load secondary workspace tabs and modals
const MaterialWriterTab = lazy(() =>
  import('../../features/writer/components/MaterialWriterTab').then((m) => ({ default: m.MaterialWriterTab })),
);
const QuizScreen = lazy(() => import('../../features/quiz/QuizScreen'));
const QuizManagementScreen = lazy(() => import('../../features/quiz-management/QuizManagementScreen'));
const FlashcardScreen = lazy(() =>
  import('../../features/flashcards/FlashcardScreen').then((m) => ({ default: m.FlashcardScreen })),
);
const AiChatDrawer = lazy(() =>
  import('../../features/ai/components/AiChatDrawer').then((m) => ({ default: m.AiChatDrawer })),
);
const ShareStudyPackageModal = lazy(() =>
  import('../../features/package/components/ShareStudyPackageModal').then((m) => ({ default: m.ShareStudyPackageModal })),
);

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
  activeTab,
  subjectId,
  onNavigate,
}: MaterialWorkspaceProps) {
  const { material, isLoading } = useMaterial(materialId);
  const { data: doc, isLoading: isDocLoading } = useDocument(material ?? null);
  const { subject } = useSubject(subjectId || material?.subjectId);
  const { term } = useTerm(material?.termId);

  // AI Chat Drawer workspace state
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);

  const handleToggleAi = useCallback(() => {
    setIsAiOpen((prev) => !prev);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+J toggles the AI Study Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        handleToggleAi();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleAi]);

  // Handle contextual "Ask AI" actions from Reader text selection
  const handleReaderAskAi = useCallback(
    (selection: { text: string; action: 'explain' | 'simplify' | 'example' }) => {
      const { sectionHeading } = extractSectionContext(doc?.content, selection.text);
      setSelectionContext({
        text: selection.text,
        action: selection.action,
        sectionHeading,
      });
      setIsAiOpen(true);
    },
    [doc?.content],
  );

  const { exportPackage, isExporting } = useExportStudyPackage();
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Define callbacks before hooks that consume them (avoids temporal dead zone)
  const handleTabChange = useCallback((tab: string) => {
    const materialTab = tab as MaterialTab;
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: materialTab, subjectId });
  }, [onNavigate, materialId, subjectId]);

  // If a brand-new material has empty content and user navigated via default route (activeTab === 'read'),
  // automatically route to 'write' on first load
  const hasAutoRoutedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoRoutedRef.current && !isDocLoading && doc !== undefined) {
      hasAutoRoutedRef.current = true;
      const isContentEmpty = !doc?.content || doc.content.trim().length === 0;
      if (activeTab === 'read' && isContentEmpty) {
        onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: 'write', subjectId });
      }
    }
  }, [isDocLoading, doc, activeTab, materialId, subjectId, onNavigate]);

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
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            label="Share"
            variant="secondary"
            icon={<Share2 size={15} />}
            onClick={() => setIsShareOpen(true)}
          >
            Share
          </Button>
          <Button
            label="Export as .lcpack"
            variant="secondary"
            icon={<Package size={15} />}
            onClick={() => exportPackage(materialId)}
            isLoading={isExporting}
            isDisabled={isExporting}
          >
            Export as .lcpack
          </Button>
          <AiDrawerToggleButton
            isOpen={isAiOpen}
            onToggle={handleToggleAi}
          />
        </div>
      }
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
            onNavigateToWrite={() => handleTabChange('write')}
            onAskAiSelection={handleReaderAskAi}
          />
        )}
        {activeTab === 'write' && (
          <Suspense fallback={<WorkspaceSkeleton />}>
            <MaterialWriterTab
              materialId={materialId}
            />
          </Suspense>
        )}
        {activeTab === 'quiz' && (
          <Suspense fallback={<WorkspaceSkeleton />}>
            <QuizScreen
              quizId=""
              materialIds={[materialId]}
              onExit={() => onNavigate({ kind: 'library' })}
              onOpenManagement={() => handleTabChange('manage')}
              embedded
            />
          </Suspense>
        )}
        {activeTab === 'flashcards' && (
          <Suspense fallback={<WorkspaceSkeleton />}>
            <FlashcardScreen
              materialId={materialId}
            />
          </Suspense>
        )}
        {activeTab === 'manage' && (
          <Suspense fallback={<WorkspaceSkeleton />}>
            <QuizManagementScreen
              materialId={materialId}
              onNavigate={onNavigate}
            />
          </Suspense>
        )}
      </AnimatedTabPanel>

      {isAiOpen && (
        <Suspense fallback={null}>
          <AiChatDrawer
            isOpen={isAiOpen}
            onClose={() => setIsAiOpen(false)}
            materialId={materialId}
            documentContext={doc?.content}
            selectionContext={selectionContext}
            onClearSelectionContext={() => setSelectionContext(null)}
          />
        </Suspense>
      )}

      {isShareOpen && (
        <Suspense fallback={null}>
          <ShareStudyPackageModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            materialId={materialId}
            materialTitle={material.title}
          />
        </Suspense>
      )}
    </Page>
  );
}

