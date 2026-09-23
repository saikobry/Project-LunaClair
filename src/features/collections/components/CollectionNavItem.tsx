import type { CSSProperties, ReactNode } from 'react';
import { getCollectionIcon } from '../modals/collectionAppearance';
import type { Collection } from '../../../domain/collections/models/Collection';

/**
 * Style-agnostic collection navigation row.
 *
 * Unifies the triplicated collection row buttons from `DesktopSidebar`
 * (`CollectionNavButton`), `CompactCollectionsPanel` rail
 * (`collectionRow`), and dock drawer (`drawerRow`).
 *
 * Styling stays with the caller: each host passes its own StyleX-compiled
 * props (`stylex.props(...)` results) plus `role`/`iconSize` for the surface
 * variant. This component owns only the shared structure — icon
 * (collection-color tinted via user-data `collection.color`, not a design
 * token) + ellipsis title + count badge — and never imports
 * layout/navigation styles, keeping the features → app direction one-way.
 */

/** A `stylex.props(...)` result: `className` (+ optional inline `style`). */
export interface CollectionNavItemSlotProps {
    className?: string;
    style?: CSSProperties;
}

export interface CollectionNavItemProps {
    collection: Collection;
    count: number;
    isActive: boolean;
    onSelect: () => void;
    buttonProps: CollectionNavItemSlotProps;
    iconWrapProps: CollectionNavItemSlotProps;
    labelProps: CollectionNavItemSlotProps;
    badgeProps: CollectionNavItemSlotProps;
    /**
     * Where the collection color lands. Sidebar/drawer tint the icon span;
     * the rail row tints the button (its `color` cascades to icon + label).
     */
    tintTarget?: 'icon' | 'button';
    /** Accessibility role for menu surfaces (`undefined` keeps a plain nav button). */
    role?: 'menuitem';
    /** Icon pixel size for the surface variant (sidebar 18, rail 16, drawer 18). */
    iconSize?: number;
    /** Optional extra content after the badge (unused today; reserved for slots). */
    children?: ReactNode;
}

export function CollectionNavItem({
    collection,
    count,
    isActive,
    onSelect,
    buttonProps,
    iconWrapProps,
    labelProps,
    badgeProps,
    tintTarget = 'icon',
    role,
    iconSize = 18,
    children,
}: CollectionNavItemProps) {
    const Icon = getCollectionIcon(collection.icon);
    const tint = collection.color ? { color: collection.color } : undefined;
    return (
        <button
            type="button"
            {...buttonProps}
            style={tintTarget === 'button' ? { ...buttonProps.style, ...tint } : buttonProps.style}
            role={role}
            onClick={onSelect}
            aria-current={isActive ? 'page' : undefined}
            title={`Collection: ${collection.title}`}
        >
            <span
                {...iconWrapProps}
                style={tintTarget === 'icon' ? { ...iconWrapProps.style, ...tint } : iconWrapProps.style}
            >
                {/* eslint-disable-next-line react/static-components -- `Icon` is a stable registry lookup from above, not a render-created component. */}
                <Icon size={iconSize} />
            </span>
            <span {...labelProps}>{collection.title}</span>
            {count > 0 && (
                <span {...badgeProps} aria-hidden="true">
                    {count}
                </span>
            )}
            {children}
        </button>
    );
}

CollectionNavItem.displayName = 'CollectionNavItem';

export default CollectionNavItem;
