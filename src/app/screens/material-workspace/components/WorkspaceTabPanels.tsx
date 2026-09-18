import type { ReactNode } from 'react';
import { Suspense, lazy } from 'react';
import type { AppRoute } from '../../../routing/routing';
import type { MaterialWorkspaceTab } from '../../../routing/routing';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';
import { AnimatedTabPanel } from '../../../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
import { WorkspaceSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';
import ReaderScreen, { type ReaderSelectionEvent } from '../../../../features/reader/ReaderScreen';
import { WorkspaceAttachments } from './WorkspaceAttachments';

// Lazy load secondary workspace tabs (Reader stays eager — it owns first paint)
const MaterialWriterTab = lazy(() =>
  import('../../../../features/writer/components/MaterialWriterTab').then((m) => ({ default: m.MaterialWriterTab })),
);
const QuizScreen = lazy(() => import('../../../../features/quiz/QuizScreen'));
const QuizManagementScreen = lazy(() => import('../../../../features/quiz-management/QuizManagementScreen'));
const FlashcardScreen = lazy(() =>
  import('../../../../features/flashcards/FlashcardScreen').then((m) => ({ default: m.FlashcardScreen })),
);

export interface WorkspaceTabPanelsProps {
  activeTab: MaterialWorkspaceTab;
  visitedTabs: MaterialWorkspaceTab[];
  materialId: string;
  /** Remount key for the embedded quiz runner (exit resets it in place). */
  quizRunId: number;
  /** Current document markdown — resolves referenced figures on Attachments. */
  documentContent?: string;
  /** Object URLs for the material's assets, keyed by asset id (screen-owned). */
  assetUrls?: Map<string, string>;
  onTabChange: (tab: string) => void;
  onAskAiSelection: (selection: ReaderSelectionEvent) => void;
  onQuizExit: () => void;
  onPreviewFile: (asset: StoredAsset) => void;
  onNavigate: (route: AppRoute) => void;
}

interface TabSlotProps {
  tabKey: MaterialWorkspaceTab;
  activeTab: MaterialWorkspaceTab;
  visitedTabs: MaterialWorkspaceTab[];
  children: ReactNode;
}

/**
 * Mount-once panel slot: unvisited tabs render nothing (so lazy tabs fetch
 * nothing until first opened); visited tabs stay mounted and hide when
 * inactive, preserving writer drafts, live quiz answers, and flashcard
 * sessions across tab switches — including switches across modes.
 */
function TabSlot({ tabKey, activeTab, visitedTabs, children }: TabSlotProps) {
  if (!visitedTabs.includes(tabKey)) return null;
  return <div hidden={activeTab !== tabKey}>{children}</div>;
}

/**
 * The workspace tab panels. Branch-free composition over `TabSlot` — all
 * mount/hide decisions live in the slot, so this composer stays flat as tabs
 * are added.
 */
export function WorkspaceTabPanels({
  activeTab,
  visitedTabs,
  materialId,
  quizRunId,
  documentContent,
  assetUrls,
  onTabChange,
  onAskAiSelection,
  onQuizExit,
  onPreviewFile,
  onNavigate,
}: WorkspaceTabPanelsProps) {
  return (
    <AnimatedTabPanel activeKey={activeTab}>
      <TabSlot tabKey="read" activeTab={activeTab} visitedTabs={visitedTabs}>
        <ReaderScreen
          materialId={materialId}
          onNavigateToWrite={() => onTabChange('write')}
          onAskAiSelection={onAskAiSelection}
          isActive={activeTab === 'read'}
        />
      </TabSlot>
      <TabSlot tabKey="quiz" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizScreen
            key={`quiz-${materialId}-${quizRunId}`}
            quizId=""
            materialIds={[materialId]}
            onExit={onQuizExit}
            onOpenManagement={() => onTabChange('questions')}
            embedded
          />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="flashcards" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <FlashcardScreen materialId={materialId} />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="write" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <MaterialWriterTab materialId={materialId} />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="questions" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizManagementScreen
            materialId={materialId}
            onNavigate={onNavigate}
            section="questions"
          />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="quizzes" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizManagementScreen
            materialId={materialId}
            onNavigate={onNavigate}
            section="quizzes"
          />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="attachments" activeTab={activeTab} visitedTabs={visitedTabs}>
        <WorkspaceAttachments
          materialId={materialId}
          documentContent={documentContent}
          assetUrls={assetUrls}
          onPreviewFile={onPreviewFile}
        />
      </TabSlot>
    </AnimatedTabPanel>
  );
}
