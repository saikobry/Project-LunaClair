import { useState } from 'react';
import type { MaterialWorkspaceTab } from '../../../routing/routing';

/**
 * Mount-once tab memory for the material workspace.
 *
 * Records every tab the user has visited this session (starting with the
 * entry tab) and never forgets. The screen renders all visited tabs and
 * hides the inactive ones, so tab switches preserve in-progress state —
 * writer drafts, live quiz answers, flashcard sessions — instead of
 * unmounting the panel and discarding it.
 */
export function useVisitedTabs(activeTab: MaterialWorkspaceTab): MaterialWorkspaceTab[] {
  const [visited, setVisited] = useState<MaterialWorkspaceTab[]>(() => [activeTab]);

  // Render-phase adjustment: re-seeds only when a genuinely new tab arrives,
  // so in-progress edits survive re-fetches that re-render the screen.
  if (!visited.includes(activeTab)) {
    setVisited([...visited, activeTab]);
  }

  return visited;
}
