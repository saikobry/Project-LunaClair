import * as stylex from '@stylexjs/stylex';
import type { LibraryViewMode } from '../../routing/routing';
import { screenStyles } from './libraryScreen.stylex';

export interface LibraryViewSwitcherProps {
  activeView: LibraryViewMode;
  onViewChange: (view: LibraryViewMode) => void;
}

/**
 * Overview | Collections | Materials switcher — one group, mutually exclusive.
 * Labels stay count-free; the section headers below carry the numbers.
 */
export function LibraryViewSwitcher({ activeView, onViewChange }: LibraryViewSwitcherProps) {
  return (
    <div
      {...stylex.props(screenStyles.viewSwitcher)}
      role="group"
      aria-label="Library view"
    >
      {(
        [
          { value: 'overview', label: 'Overview' },
          { value: 'collections', label: 'Collections' },
          { value: 'materials', label: 'Materials' },
        ] as { value: LibraryViewMode; label: string }[]
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={activeView === option.value}
          {...stylex.props(
            screenStyles.viewOption,
            activeView === option.value && screenStyles.viewOptionActive,
          )}
          onClick={() => onViewChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default LibraryViewSwitcher;
