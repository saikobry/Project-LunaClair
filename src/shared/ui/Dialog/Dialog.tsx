import { type ReactNode, type Ref, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Dialog as AstryxDialog } from '@astryxdesign/core/Dialog';

export interface DialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Callback fired when the dialog requests to close. */
  onClose: () => void;
  /** Dialog title (rendered as header). */
  title?: string;
  /** Dialog content. */
  children?: ReactNode;
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
 * Exposes LunaClair-owned props. Astryx handles focus trapping,
 * ESC key handling, backdrop overlay, and scroll locking.
 * The title prop is rendered inside the dialog as a heading.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  width = 420,
  maxHeight = '75vh',
  purpose = 'info',
  ref,
  className,
  style,
  ...ariaProps
}: DialogProps) {
  const dialogInnerRef = useRef<HTMLDivElement>(null);

  // ── Spring entrance animation on open ─────────────────────────
  useEffect(() => {
    if (!isOpen || !dialogInnerRef.current) return;
    const el = dialogInnerRef.current;
    gsap.fromTo(
      el,
      { scale: 0.94, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.4)', overwrite: 'auto' },
    );
    // No cleanup on purpose — the animation only plays forward on open.
  }, [isOpen]);

  return (
    <AstryxDialog
      ref={ref}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={width}
      maxHeight={maxHeight}
      purpose={purpose}
      className={className}
      style={{ border: 'none', ...style }}
      {...ariaProps}
    >
      <div ref={dialogInnerRef}>
      {title && (
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          {title}
        </h2>
      )}
      {children}
      </div>
    </AstryxDialog>
  );
}

Dialog.displayName = 'Dialog';
