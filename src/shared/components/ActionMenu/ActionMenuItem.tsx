import {
  DropdownMenuItem,
  type DropdownMenuItemProps,
} from '@astryxdesign/core/DropdownMenu';
import { menuItemStyles } from './menuItemStyles';

export interface ActionMenuItemProps extends DropdownMenuItemProps {}

/**
 * ActionMenuItem — LunaClair adapter over @astryxdesign/core DropdownMenuItem.
 *
 * Applies the shared `menuItemStyles.item` hover/focus treatment by
 * default so feature consumers don't need to repeat it. All Astryx
 * DropdownMenuItem props (icon, label, description, onClick, ...) pass
 * through unchanged, and an explicit `xstyle` still composes on top.
 *
 * Must be rendered inside an ActionMenu.
 */
export function ActionMenuItem({ xstyle, ...props }: ActionMenuItemProps) {
  return <DropdownMenuItem xstyle={[menuItemStyles.item, xstyle]} {...props} />;
}

ActionMenuItem.displayName = 'ActionMenuItem';
