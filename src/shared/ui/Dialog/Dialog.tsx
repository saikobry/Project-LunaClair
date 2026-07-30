import { type ReactNode, type Ref, useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { Dialog as AstryxDialog } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { DialogHeader } from '@astryxdesign/core/Dialog';

export interface DialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Callback fired when the dialog requests to close. */
  onClose: () => void;
  /** Dialog title (rendered as header). */
  title?: string;
  /** Dialog content (scrollable body). */
  children?: ReactNode;
  /** Dialog footer (sticky actions bar). */
  footer?: ReactNode;
  /** Width. Numbers = pixels, strings = CSS value. @default 420 */
  width?: number | string;
  /** Max height. Numbers = pixels, strings = CSS value. @default '75vh' */
  maxHeight?: number | string;
  /** Dismissal behavior. @default 'info' */
  purpose?: 'required' | 'form' | 'info';
  /** Ref forwarded to the dialog element. */
  ref?: Ref<HTMLDialogElement>;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** ARIA label for the dialog. */
  'aria-label'?: string;
}

/**
 * LunaClair Dialog — thin adapter over @astryxdesign/core Dialog.
 *
 * Uses Astryx Layout with header / content / footer slot props for
 * structured header, scrollable content, and sticky footer.
 * The title prop renders in the header slot, children in the content slot,
 * and the optional footer prop in the sticky footer slot.
 *
 * The footer divider is shown only when the content area is actually
 * scrollable (overflowing), so the visual separation only appears
 * when scrolling is in effect.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 420,
  maxHeight = '75vh',
  purpose = 'info',
  ref,
  className,
  style,
  ...ariaProps
}: DialogProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const contentObserverRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  // ── Detect content overflow to conditionally show dividers ──
  useEffect(() => {
    const el = contentObserverRef.current;
    if (!el) return;

    const checkScrollable = () => {
      const parent = el?.parentElement;
      if (parent) {
        // +1 pixel tolerance for sub-pixel rounding
        setIsScrollable(parent.scrollHeight > parent.clientHeight + 1);
      }
    };

    const observer = new ResizeObserver(() => {
      checkScrollable();
    });

    // Observe both the observer div (content changes) and its parent (layout changes)
    observer.observe(el);
    if (el.parentElement) {
      observer.observe(el.parentElement);
    }

    // Check immediately on mount / open
    checkScrollable();

    return () => observer.disconnect();
  }, [isOpen]);

  // Shared close handler — passed to both AstryxDialog and DialogHeader
  const handleClose = (open: boolean) => {
    if (!open) onClose();
  };

  // ── Spring entrance animation on open ─────────────────────────
  useEffect(() => {
    if (!isOpen || !layoutRef.current) return;
    const el = layoutRef.current;
    gsap.fromTo(
      el,
      { scale: 0.94, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.4)', overwrite: 'auto' },
    );
  }, [isOpen]);

  return (
    <AstryxDialog
      ref={ref}
      isOpen={isOpen}
      onOpenChange={handleClose}
      width={width}
      maxHeight={maxHeight}
      purpose={purpose}
      className={className}
      style={{ border: 'none', ...style }}
      {...ariaProps}
    >
      <div ref={layoutRef} style={{ height: '100%' }}>
        <Layout
          height="fill"
          header={title ? (
            <DialogHeader
              title={title}
              onOpenChange={handleClose}
              hasDivider={isScrollable}
            />
          ) : undefined}
          content={
            <LayoutContent>
              <div ref={contentObserverRef}>
                {children}
              </div>
            </LayoutContent>
          }
          footer={footer ? (
            <LayoutFooter hasDivider={isScrollable}>
              {footer}
            </LayoutFooter>
          ) : undefined}
        />
      </div>
    </AstryxDialog>
  );
}

Dialog.displayName = 'Dialog';
