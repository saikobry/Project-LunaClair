import type { LibraryViewMode } from '../../../routing/routing';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '../../../../shared/ui/SegmentedControl/SegmentedControl';
import { useMediaQuery } from '../../../../shared/hooks/useMediaQuery';
import { screenStyles } from '../styles/libraryScreen.stylex';

export interface LibraryViewSwitcherProps {
  activeView: LibraryViewMode;
  onViewChange: (view: LibraryViewMode) => void;
}

const VIEW_OPTIONS: { value: LibraryViewMode; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'collections', label: 'Collections' },
  { value: 'materials', label: 'Materials' },
];

function isLibraryViewMode(value: string): value is LibraryViewMode {
  return value === 'overview' || value === 'collections' || value === 'materials';
}

/**
 * Overview | Collections | Materials switcher — one group, mutually exclusive.
 * Labels stay count-free; the section headers below carry the numbers.
 *
 * Built on the shared `SegmentedControl` instead of bespoke buttons: this is a
 * mutually-exclusive option selector that drives a routing mode (not a tab
 * panel switch), which is exactly what a segmented control models — and it
 * brings the APG arrow-key move-and-select behavior for free. `label` is the
 * accessible name. Contrast `WorkspaceModeSwitch`, which stays a real
 * `tablist`/`tab` because it switches visible panels.
 *
 * Layout is responsive: the control hugs its options on desktop and fills the
 * row on mobile (≤768px, the breakpoint `SegmentedControl` itself treats as
 * mobile for its scroll container), so the three options stay an even, fully
 * tappable target instead of shrinking into the corner of a narrow screen.
 * Same `isMobile ? 'fill' : 'hug'` pattern the importer review view uses.
 */
export function LibraryViewSwitcher({ activeView, onViewChange }: LibraryViewSwitcherProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <SegmentedControl
      label="Library view"
      value={activeView}
      onChange={(value) => {
        if (isLibraryViewMode(value)) onViewChange(value);
      }}
      size="sm"
      layout={isMobile ? 'fill' : 'hug'}
      xstyle={screenStyles.viewSwitcherSlot}
    >
      {VIEW_OPTIONS.map((option) => (
        <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
      ))}
    </SegmentedControl>
  );
}

export default LibraryViewSwitcher;
