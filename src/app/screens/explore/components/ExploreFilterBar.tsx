import * as stylex from '@stylexjs/stylex';
import { Search } from 'lucide-react';
import { Input } from '../../../../shared/ui/Input/Input';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '../../../../shared/ui/SegmentedControl/SegmentedControl';
import {
  isExploreSortOption,
  type ExploreSortOption,
} from '../../../../features/discovery/explore.types';
import { styles } from '../styles/exploreFilterBar.stylex';

export interface ExploreFilterBarProps {
  /** In-progress search text (committed to the URL by the screen's draft hook). */
  search: string;
  onSearchChange: (value: string) => void;
  sort: ExploreSortOption;
  onSortChange: (sort: ExploreSortOption) => void;
}

/** Search + sort controls for the Explore hub. Pure presentation. */
export function ExploreFilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: ExploreFilterBarProps) {
  return (
    <div {...stylex.props(styles.filterBar)}>
      <div {...stylex.props(styles.searchField)}>
        <Input
          label="Search explore content"
          labelHidden
          value={search}
          onChange={onSearchChange}
          placeholder="Search study packages, authors..."
          startIcon={<Search size={16} />}
          clearable
          size="md"
        />
      </div>

      {/* Shared segmented control, not a bespoke `<select>`: the app's own
          vocabulary, options always visible, and arrow-key move-and-select from
          the component's APG behavior. `label` is its accessible name. */}
      <SegmentedControl
        label="Sort explore items"
        value={sort}
        onChange={(value) => {
          if (isExploreSortOption(value)) onSortChange(value);
        }}
        size="sm"
        xstyle={styles.sortControl}
      >
        <SegmentedControlItem value="popular" label="Popular" />
        <SegmentedControlItem value="recent" label="Recent" />
      </SegmentedControl>
    </div>
  );
}

export default ExploreFilterBar;
