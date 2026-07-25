import { type ReactNode, type Ref } from 'react';
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
      style={style}
      {...ariaProps}
    >
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
    </AstryxDialog>
  );
}

Dialog.displayName = 'Dialog';
