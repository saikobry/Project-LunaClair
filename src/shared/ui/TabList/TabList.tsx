import * as stylex from '@stylexjs/stylex';
import {
    TabList as AstryxTabList,
    Tab,
} from '@astryxdesign/core/TabList';
import type { TabListProps, TabProps } from '@astryxdesign/core/TabList';

export { Tab };
export type { TabListProps, TabProps };

const styles = stylex.create({
    wrapper: {
        marginBottom: 20,
    },
});

/**
 * LunaClair TabList — thin adapter over @astryxdesign/core TabList.
 * Applies a default bottom margin for consistent spacing below tab bars.
 */
export function TabList(props: TabListProps) {
    return (
        <div {...stylex.props(styles.wrapper)}>
            <AstryxTabList {...props} />
        </div>
    );
}

TabList.displayName = 'TabList';
