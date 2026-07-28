import { useCallback, type KeyboardEvent } from 'react';

/**
 * WAI-ARIA keyboard navigation for tab lists.
 *
 * Usage:
 * ```tsx
 * const tabProps = useTabKeyboardNavigation({
 *   tabs: ['read', 'quiz', 'manage'] as const,
 *   activeTab,
 *   onTabChange: setActiveTab,
 *   tablistRef,
 * });
 *
 * <div role="tablist" ref={tablistRef} onKeyDown={tabProps.handleKeyDown}>
 *   {tabs.map(tab => (
 *     <button
 *       key={tab}
 *       role="tab"
 *       aria-selected={activeTab === tab}
 *       aria-controls={`panel-${tab}`}
 *       tabIndex={activeTab === tab ? 0 : -1}
 *       onClick={() => handleTabChange(tab)}
 *     >
 *       {label}
 *     </button>
 *   ))}
 * </div>
 * ```
 *
 * ArrowLeft/ArrowRight cycle through tabs. Home/End go to first/last.
 * Supports both single and multi-dimensional tab arrays.
 */
export function useTabKeyboardNavigation<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = tabs.indexOf(activeTab);
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (nextIndex !== null) {
        onTabChange(tabs[nextIndex]);
      }
    },
    [tabs, activeTab, onTabChange],
  );

  return { handleKeyDown };
}
