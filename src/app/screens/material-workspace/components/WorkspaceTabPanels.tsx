import type { ReactNode } from 'react';
import { Suspense, lazy } from 'react';
import type { AppRoute } from '../../../routing/routing';
import type { MaterialWorkspaceTab } from '../../../routing/routing';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';
import { AnimatedTabPanel } from '../../../../shared/ui/AnimatedTabPanel/AnimatedTabPanel';
import { WorkspaceSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';
import ReaderTab, { type ReaderSelectionEvent } from '../../../../features/reader/ReaderTab';
import type { GeneratorLaunchChannel } from '../../../../features/quiz-management/hooks/useGeneratorLaunchClaim';
import { WorkspaceAttachments } from './WorkspaceAttachments';

// Lazy load secondary workspace tabs (Reader stays eager — it owns first paint)
const MaterialWriterTab = lazy(() =>
  import('../../../../features/writer/components/MaterialWriterTab').then((m) => ({ default: m.MaterialWriterTab })),
);
const QuizTab = lazy(() => import('../../../../features/quiz/QuizTab'));
const QuizManagementTab = lazy(() => import('../../../../features/quiz-management/QuizManagementTab'));
const FlashcardTab = lazy(() =>
  import('../../../../features/flashcards/FlashcardTab').then((m) => ({ default: m.FlashcardTab })),
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
  /**
   * Opens the Question Bank's generator for this material with Fill in the Blank
   * preselected, and a way back to the Flashcards tab when the batch is saved.
   * Arms the screen's one-shot launch intent and then makes the ordinary tab change —
   * the mode tier still changes, because the Bank genuinely lives in Manage.
   */
  onGenerateCards: () => void;
  /**
   * The screen-held one-shot launch intent (pending request + the command that retires it),
   * forwarded to the Questions panel. Threaded, not broadcast: the request is addressed to this
   * material's Question Bank, which is a descendant two hops down.
   */
  generatorLaunch: GeneratorLaunchChannel;
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
  onGenerateCards,
  generatorLaunch,
}: WorkspaceTabPanelsProps) {
  return (
    <AnimatedTabPanel activeKey={activeTab}>
      <TabSlot tabKey="read" activeTab={activeTab} visitedTabs={visitedTabs}>
        <ReaderTab
          materialId={materialId}
          onNavigateToWrite={() => onTabChange('write')}
          onAskAiSelection={onAskAiSelection}
          isActive={activeTab === 'read'}
        />
      </TabSlot>
      <TabSlot tabKey="quiz" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizTab
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
          {/* The flashcards feature owns no content, so its only authoring affordance is a
              handoff to the Question Bank — expressed as the ordinary `?tab=questions` route
              (the mode tier still changes; the Bank genuinely lives in Manage) plus the
              screen's one-shot launch intent, exactly as the quiz tab's "Open Management"
              uses the tab route. It is not a second authoring path: the same single dialog
              opens, and the same single use case persists. */}
          <FlashcardTab materialId={materialId} onOpenQuestionBank={onGenerateCards} />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="write" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <MaterialWriterTab materialId={materialId} />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="questions" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          <QuizManagementTab
            materialId={materialId}
            onNavigate={onNavigate}
            section="questions"
            onReturnToTab={(tab) => onTabChange(tab)}
            generatorLaunch={generatorLaunch}
          />
        </Suspense>
      </TabSlot>
      <TabSlot tabKey="quizzes" activeTab={activeTab} visitedTabs={visitedTabs}>
        <Suspense fallback={<WorkspaceSkeleton />}>
          {/* Same required prop on both sections; only the Question Bank acts on it (the Quiz
              Catalog authors quizzes, not questions, so it never opens the generator). */}
          <QuizManagementTab
            materialId={materialId}
            onNavigate={onNavigate}
            section="quizzes"
            generatorLaunch={generatorLaunch}
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
