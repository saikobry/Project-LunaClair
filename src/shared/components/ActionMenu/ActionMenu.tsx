import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';
import { MoreHorizontal } from 'lucide-react';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import {
  DropdownMenuContext,
  type DropdownMenuContextValue,
} from '@astryxdesign/core/DropdownMenu';

const fadeSlideIn = stylex.keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const styles = stylex.create({
  wrapper: {
    position: 'relative',
  },
  popup: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 150,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(229,228,231,0.7)',
    borderRadius: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.12)',
    zIndex: 100,
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    animationName: fadeSlideIn,
    animationDuration: '0.15s',
    animationTimingFunction: 'ease-out',
  },
  popupHidden: {
    display: 'none',
  },
});

/**
 * Reusable StyleX styles for DropdownMenuItem to enable smooth hover
 * transitions inside an ActionMenu. Pass via the `xstyle` prop:
 *
 * ```tsx
 * <DropdownMenuItem xstyle={menuItemStyles.item} ... />
 * ```
 */
export const menuItemStyles = stylex.create({
  item: {
    borderRadius: 6,
    transition: 'background-color 0.12s ease',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.10)',
    },
    ':focus': {
      backgroundColor: 'rgba(0, 0, 0, 0.10)',
    },
  },
});

export interface ActionMenuProps {
  /** Accessible label for the trigger button. @default "Card actions" */
  label?: string;
  /** Menu content — typically Astryx DropdownMenuItem components. */
  children?: ReactNode;
}

/**
 * ActionMenu — a reusable icon-only ellipsis menu trigger with a
 * glassmorphic dropdown popup.
 *
 * Handles open/close state, outside-click dismissal, Escape key, and
 * focus blur automatically. Wraps children in a DropdownMenuContext so
 * Astryx DropdownMenuItem components can auto-close the menu on click.
 *
 * The popup is always rendered in the DOM (hidden via display:none when
 * closed) so React's synthetic event dispatch completes reliably before
 * the close state takes effect — this prevents clicks from propagating
 * to parent card handlers when a menu item unmounts itself mid-event.
 *
 * @example
 * ```tsx
 * <ActionMenu>
 *   <DropdownMenuItem icon={<SquarePen size={14} />} label="Edit" onClick={handleEdit} />
 *   <DropdownMenuItem icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} />
 * </ActionMenu>
 * ```
 */
export function ActionMenu({ label = 'Card actions', children }: ActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, closeMenu]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen, closeMenu]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    // Prevent clicks inside the action menu from propagating to
    // parent card click handlers. The popup stays in the DOM even
    // when closed (visibility toggled via CSS), so React's synthetic
    // event dispatch completes and this handler fires reliably.
    e.stopPropagation();
  };

  const handleMenuBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      closeMenu();
    }
  };

  // Provide DropdownMenuContext so DropdownMenuItem children
  // can auto-close the menu via ctx.closeMenu() on click
  const contextValue: DropdownMenuContextValue = {
    closeMenu,
    menuSize: 'md',
  };

  return (
    <div
      ref={menuRef}
      {...stylex.props(styles.wrapper)}
      onClick={handleWrapperClick}
      onBlur={handleMenuBlur}
    >
      <ToggleButton
        label={label}
        icon={<MoreHorizontal size={16} />}
        isIconOnly
        isPressed={menuOpen}
        onPressedChange={(_pressed, e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
      />

      {/*
        Always render the popup to keep the DOM subtree alive during
        React's synthetic event dispatch. When a DropdownMenuItem
        triggers closeMenu(), the state update is queued but the popup
        hasn't been re-rendered yet — so the wrapper's onClick handler
        receives the event and calls stopPropagation() before the native
        event can reach parent card handlers.
        Visibility is toggled with display:none instead.
      */}
      <div
        {...stylex.props(styles.popup, !menuOpen && styles.popupHidden)}
        role="menu"
      >
        <DropdownMenuContext value={contextValue}>
          {children}
        </DropdownMenuContext>
      </div>
    </div>
  );
}

ActionMenu.displayName = 'ActionMenu';
