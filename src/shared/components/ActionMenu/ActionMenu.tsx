import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
    position: 'fixed',
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

function stopActionMenuPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

export interface ActionMenuProps {
  /** Accessible label for the trigger button. @default "Card actions" */
  label?: string;
  /** Menu content — typically ActionMenuItem components. */
  children?: ReactNode;
}

/**
 * ActionMenu — a reusable icon-only ellipsis menu trigger with a
 * glassmorphic dropdown popup.
 *
 * Handles open/close state, outside-click dismissal, Escape key, and
 * focus blur automatically. Wraps children in a DropdownMenuContext so
 * menu items (e.g. ActionMenuItem) can auto-close the menu on click.
 *
 * The popup is always rendered in the DOM (hidden via display:none when
 * closed) so React's synthetic event dispatch completes reliably before
 * the close state takes effect — this prevents clicks from propagating
 * to parent card handlers when a menu item unmounts itself mid-event.
 *
 * @example
 * ```tsx
 * <ActionMenu>
 *   <ActionMenuItem icon={<SquarePen size={14} />} label="Edit" onClick={handleEdit} />
 *   <ActionMenuItem icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} />
 * </ActionMenu>
 * ```
 */
export function ActionMenu({ label = 'Card actions', children }: ActionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  /** Fixed viewport coords for the portaled popup, right-anchored to the trigger. */
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const updatePos = useCallback(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 300 && rect.top > spaceBelow) {
      setPos({ bottom: Math.max(8, window.innerHeight - rect.top + 6), right });
    } else {
      setPos({ top: rect.bottom + 6, right });
    }
  }, []);

  // Measure before paint so the popup never flashes at a default spot, then
  // track scroll/resize while open like the card popovers do.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [menuOpen, updatePos]);

  // Close menu on click outside (the portaled popup lives outside the wrapper,
  // so both roots keep it open)
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      closeMenu();
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

  const handleMenuBlur = (e: React.FocusEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (menuRef.current?.contains(related) || popupRef.current?.contains(related))) {
      return;
    }
    closeMenu();
  };

  // Provide DropdownMenuContext so DropdownMenuItem children
  // can auto-close the menu via ctx.closeMenu() on click
  const contextValue: DropdownMenuContextValue = {
    closeMenu,
    menuSize: 'md',
  };

  // Right-anchored fixed coords — no width measuring needed. Unset until the
  // layout effect measures (the popup stays display:none while closed anyway).
  const popupStyle: CSSProperties = {
    ...(pos?.top !== undefined ? { top: pos.top } : {}),
    ...(pos?.bottom !== undefined ? { bottom: pos.bottom } : {}),
    ...(pos ? { right: pos.right } : {}),
  };

  return (
    <div
      ref={menuRef}
      {...stylex.props(styles.wrapper)}
      onClick={stopActionMenuPropagation}
      onBlur={handleMenuBlur}
    >
      <ToggleButton
        label={label}
        icon={<MoreHorizontal size={16} />}
        isIconOnly
        isPressed={menuOpen}
        onPressedChange={(_pressed, e) => {
          e.stopPropagation();
          e.preventDefault();
          setMenuOpen((prev) => !prev);
        }}
      />

      {/*
        Portaled to document.body with fixed positioning so the popup escapes
        the card's stacking context (the hover lift transform traps an
        absolutely-positioned popup beneath the next sibling card). React
        events still bubble through the wrapper, so the stopPropagation guard
        and the always-rendered subtree behavior are unchanged.
        Visibility is toggled with display:none instead.
      */}
      {createPortal(
        <div
          ref={popupRef}
          {...stylex.props(styles.popup, !menuOpen && styles.popupHidden)}
          style={popupStyle}
          role="menu"
        >
          <DropdownMenuContext value={contextValue}>
            {children}
          </DropdownMenuContext>
        </div>,
        document.body,
      )}
    </div>
  );
}

ActionMenu.displayName = 'ActionMenu';
