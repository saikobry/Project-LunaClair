import { useState, useMemo } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { Token as AstryxToken } from '@astryxdesign/core/Token';
import type { TokenProps as AstryxTokenProps, TokenColor, TokenSize } from '@astryxdesign/core/Token';
import { X } from 'lucide-react';

export type TokenProps = AstryxTokenProps;
export type { TokenColor, TokenSize };

const removeButtonBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  minWidth: 24,
  minHeight: 24,
  borderRadius: '50%',
  border: 'none',
  padding: 0,
  marginRight: -4,
  marginLeft: 0,
  cursor: 'pointer',
  color: 'inherit',
  transition: 'background-color 0.15s ease, opacity 0.15s ease',
  flexShrink: 0,
};

function RemoveButton({ onRemove, label }: { onRemove: (e: MouseEvent) => void; label: string }) {
  const [isHovered, setIsHovered] = useState(false);

  const style = useMemo<CSSProperties>(
    () => ({
      ...removeButtonBaseStyle,
      backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.14)' : 'transparent',
      opacity: isHovered ? 1 : 0.75,
    }),
    [isHovered],
  );

  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onRemove(e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
    >
      <X size={11} strokeWidth={2.5} />
    </button>
  );
}

/**
 * LunaClair Token — thin adapter over @astryxdesign/core Token.
 *
 * Replaces Astryx's default remove button with a custom styled close button
 * featuring a crisp Lucide X icon and smooth hover feedback.
 */
export function Token({ onRemove, ...props }: TokenProps) {
  if (onRemove) {
    return (
      <AstryxToken
        {...props}
        endContent={<RemoveButton onRemove={onRemove} label={props.label} />}
      />
    );
  }

  return <AstryxToken {...props} />;
}

Token.displayName = 'Token';
