import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, Layers, PenTool, Library, ListChecks, Paperclip } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import { isMaterialWorkspaceTab, workspaceModeOfTab, type MaterialWorkspaceTab, type WorkspaceMode } from '../../routing/routing';
import { useMaterial } from '../../../features/materials/hooks/queries/useMaterial';
import { useCollection } from '../../../features/collections/hooks/queries/useCollection';
import { useDocument } from '../../../features/reader/hooks/useDocument';
import { useMaterialAssets } from '../../../features/reader/hooks/useMaterialAssets';
import type { StoredAsset } from '../../../domain/assets/repositories/AssetRepository';
import { Page } from '../../../shared/ui/Page/Page';
import { Breadcrumbs, type BreadcrumbItem } from '../../../shared/ui/Breadcrumbs/Breadcrumbs';
import { TabList, Tab } from '../../../shared/ui/TabList/TabList';
import { WorkspaceSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import type { ReaderSelectionEvent } from '../../../features/reader/ReaderScreen';
import { extractSectionContext } from '../../../domain/ai/context/extractSectionContext';
import type { SelectionContext } from '../../../features/ai/components/AiChatDrawer';
import { workspaceBreadcrumbs } from './utils/workspaceBreadcrumbs';
import { useVisitedTabs } from './hooks/useVisitedTabs';
import { useWorkspaceAssets } from './hooks/useWorkspaceAssets';
import { WorkspaceActions } from './components/WorkspaceActions';
import { WorkspaceMetaTags } from './components/WorkspaceMetaTags';
import { WorkspaceModeSwitch } from './components/WorkspaceModeSwitch';
import { WorkspaceNotFound } from './components/WorkspaceNotFound';
import { WorkspaceSourceDialog } from './components/WorkspaceSourceDialog';
import { WorkspaceTabPanels } from './components/WorkspaceTabPanels';
import { workspaceStyles } from './styles/materialWorkspace.stylex';

const AiChatDrawer = lazy(() =>
  import('../../../features/ai/components/AiChatDrawer').then((m) => ({ default: m.AiChatDrawer })),
);
const ShareStudyPackageModal = lazy(() =>
  import('../../../features/package/components/ShareStudyPackageModal').then((m) => ({ default: m.ShareStudyPackageModal })),
);

interface WorkspaceTabDef {
  key: MaterialWorkspaceTab;
  label: string;
  icon: typeof BookOpen;
}

// Hoisted to module scope for a stable reference across renders.
// Keys are URL state (`?tab=`); labels are presentation and can change freely.
// Two tiers: Study is the everyday surface, Manage the back office. Labels
// stay distinct from their mode and sibling icons stay distinct on screen.
const STUDY_TABS: WorkspaceTabDef[] = [
  { key: 'read', label: 'Read', icon: BookOpen },
  { key: 'quiz', label: 'Quiz', icon: BrainCircuit },
  { key: 'flashcards', label: 'Flashcards', icon: Layers },
];

const MANAGE_TABS: WorkspaceTabDef[] = [
  { key: 'write', label: 'Document', icon: PenTool },
  { key: 'questions', label: 'Question Bank', icon: Library },
  { key: 'quizzes', label: 'Quiz Catalog', icon: ListChecks },
  { key: 'attachments', label: 'Attachments', icon: Paperclip },
];

/** Backwards-compatible alias — the canonical union lives in `routing.ts`. */
export type MaterialTab = MaterialWorkspaceTab;

export interface MaterialWorkspaceScreenProps {
  materialId: string;
  activeTab: MaterialWorkspaceTab;
  /** Collection the user opened this material from, when there was one (`?from=`). */
  fromCollectionId?: string;
  onNavigate: (route: AppRoute) => void;
}

export function MaterialWorkspaceScreen({
  materialId,
  activeTab,
  fromCollectionId,
  onNavigate,
}: MaterialWorkspaceScreenProps) {
  // A stale or crafted ?tab= degrades to 'read' (the parser already
  // normalizes, but this guards direct prop use) so the screen never renders
  // a tab strip with no matching panel.
  const safeTab: MaterialWorkspaceTab = isMaterialWorkspaceTab(activeTab) ? activeTab : 'read';
  const mode: WorkspaceMode = workspaceModeOfTab(safeTab);
  const { material, isLoading } = useMaterial(materialId);
  const { data: doc } = useDocument(material ?? null);
  const assetUrls = useMaterialAssets(materialId);
  const { assets } = useWorkspaceAssets(materialId);
  // Origin, not membership: only the collection the user actually came from
  // earns a breadcrumb. A deleted origin resolves to null and the crumb drops.
  const { collection: originCollection } = useCollection(fromCollectionId);

  // Mount-once tab memory: visited tabs stay mounted and hide when inactive,
  // so switching tabs preserves writer drafts, live quiz answers, and
  // flashcard sessions instead of discarding them on unmount — including
  // switches across modes.
  const visitedTabs = useVisitedTabs(safeTab);

  // Last-visited tab per mode: the mode switch returns to where the mode was
  // left. Re-synced during render (guarded adjustment, so Back/Forward and
  // deep links correct it) and recorded on every tab change.
  const [lastInMode, setLastInMode] = useState<Record<WorkspaceMode, MaterialWorkspaceTab>>({
    study: 'read',
    manage: 'write',
  });
  if (lastInMode[mode] !== safeTab) {
    setLastInMode({ ...lastInMode, [mode]: safeTab });
  }

  // Remount key for the embedded quiz runner: exiting a finished quiz resets
  // to the quiz overview *inside* the workspace instead of leaving for the
  // library and losing the study context.
  const [quizRunId, setQuizRunId] = useState(0);
  const handleQuizExit = useCallback(() => {
    setQuizRunId((id) => id + 1);
  }, []);

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
    (selection: ReaderSelectionEvent) => {
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

  const [isShareOpen, setIsShareOpen] = useState(false);

  // Preserved-original viewer: the Source action (header) and attachment
  // Preview buttons converge on one dialog over the screen-owned URL map.
  const [sourceAsset, setSourceAsset] = useState<StoredAsset | null>(null);
  const sourceUrl = sourceAsset ? assetUrls?.get(sourceAsset.assetId) : undefined;
  const originalAsset = assets.find((asset) => asset.assetId === asset.materialId);

  // Every route the workspace re-emits preserves `fromCollectionId`: the tab is
  // the only thing changing, so dropping the origin here would silently erase
  // the collection breadcrumb on the first tab click.
  const handleTabChange = useCallback((tab: string) => {
    if (!isMaterialWorkspaceTab(tab)) return;
    setLastInMode((prev) => ({ ...prev, [workspaceModeOfTab(tab)]: tab }));
    onNavigate({ kind: 'workspace', workspace: 'material', materialId, activeTab: tab, fromCollectionId });
  }, [onNavigate, materialId, fromCollectionId]);

  const handleModeChange = useCallback((nextMode: WorkspaceMode) => {
    onNavigate({
      kind: 'workspace',
      workspace: 'material',
      materialId,
      activeTab: lastInMode[nextMode],
      fromCollectionId,
    });
  }, [onNavigate, materialId, fromCollectionId, lastInMode]);

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    if (!material) return [];
    return workspaceBreadcrumbs(material.title, originCollection).map((crumb) => {
      const target = crumb.target;
      return { label: crumb.label, onClick: target ? () => onNavigate(target) : undefined };
    });
  }, [material, originCollection, onNavigate]);

  if (isLoading) {
    return (
      <Page title="Material" headerHidden>
        <div {...stylex.props(workspaceStyles.loading)}>
          <WorkspaceSkeleton />
        </div>
      </Page>
    );
  }

  if (!material) {
    return (
      <Page title="Material not found">
        <WorkspaceNotFound fromCollectionId={fromCollectionId} onNavigate={onNavigate} />
      </Page>
    );
  }

  const modeTabs = mode === 'study' ? STUDY_TABS : MANAGE_TABS;

  return (
    <Page
      title={material.title}
      description={material.description}
      breadcrumb={<Breadcrumbs items={breadcrumbItems} />}
      actions={
        <WorkspaceActions
          materialId={materialId}
          isAiOpen={isAiOpen}
          onToggleAi={handleToggleAi}
          onShare={() => setIsShareOpen(true)}
          hasSource={originalAsset !== undefined}
          onOpenSource={() => originalAsset && setSourceAsset(originalAsset)}
        />
      }
    >
      <WorkspaceMetaTags tags={material.tags} />

      <WorkspaceModeSwitch mode={mode} onModeChange={handleModeChange} />
      <div {...stylex.props(workspaceStyles.tabBar)}>
        <TabList value={safeTab} onChange={handleTabChange} layout="hug" hasDivider aria-label="Material tabs">
          {modeTabs.map(({ key, label, icon: Icon }) => (
            <Tab key={key} value={key} label={label} icon={<Icon size={15} />} />
          ))}
        </TabList>
      </div>

      <WorkspaceTabPanels
        activeTab={safeTab}
        visitedTabs={visitedTabs}
        materialId={materialId}
        quizRunId={quizRunId}
        documentContent={doc?.content}
        assetUrls={assetUrls}
        onTabChange={handleTabChange}
        onAskAiSelection={handleReaderAskAi}
        onQuizExit={handleQuizExit}
        onPreviewFile={setSourceAsset}
        onNavigate={onNavigate}
      />

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

      {sourceAsset && sourceUrl && (
        <Suspense fallback={null}>
          <WorkspaceSourceDialog
            asset={sourceAsset}
            objectUrl={sourceUrl}
            onClose={() => setSourceAsset(null)}
          />
        </Suspense>
      )}
    </Page>
  );
}

export default MaterialWorkspaceScreen;
