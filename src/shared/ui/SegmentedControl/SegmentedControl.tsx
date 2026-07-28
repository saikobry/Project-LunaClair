import * as stylex from '@stylexjs/stylex';
import {
  SegmentedControl as AstryxSegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
import type { SegmentedControlProps as AstryxSegmentedControlProps } from '@astryxdesign/core/SegmentedControl';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  scrollableContainer: {
    width: '100%',
    boxSizing: 'border-box',
    [mobile]: {
      display: 'flex',
      maxWidth: '100%',
      width: '100%',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      borderRadius: 'var(--radius-element, 8px)',
      '::-webkit-scrollbar': {
        display: 'none',
      },
    },
  },
});

export function SegmentedControl({
  xstyle,
  layout = 'fill',
  ...props
}: AstryxSegmentedControlProps) {
  const combinedXstyle = xstyle
    ? ([styles.scrollableContainer, xstyle] as unknown as AstryxSegmentedControlProps['xstyle'])
    : (styles.scrollableContainer as unknown as AstryxSegmentedControlProps['xstyle']);

  return (
    <AstryxSegmentedControl
      {...props}
      layout={layout}
      xstyle={combinedXstyle}
    />
  );
}

export { SegmentedControlItem };
export type {
  SegmentedControlProps,
  SegmentedControlItemProps,
} from '@astryxdesign/core/SegmentedControl';
