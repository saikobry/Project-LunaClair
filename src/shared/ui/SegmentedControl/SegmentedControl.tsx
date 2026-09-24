import * as stylex from '@stylexjs/stylex';
import {
  SegmentedControl as AstryxSegmentedControl,
  SegmentedControlItem,
} from '@astryxdesign/core/SegmentedControl';
import type { SegmentedControlProps as AstryxSegmentedControlProps } from '@astryxdesign/core/SegmentedControl';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  scrollableContainer: {
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    [mobile]: {
      display: 'flex',
      maxWidth: '100%',
      width: '100%',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      borderRadius: 'var(--radius-element)',
      '::-webkit-scrollbar': {
        display: 'none',
      },
    },
  },
  fillWidth: {
    width: '100%',
  },
});

export function SegmentedControl({
  xstyle,
  layout = 'hug',
  ...props
}: AstryxSegmentedControlProps) {
  const combinedXstyle = [
    styles.scrollableContainer,
    layout === 'fill' && styles.fillWidth,
    xstyle,
  ].filter(Boolean) as unknown as AstryxSegmentedControlProps['xstyle'];

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
