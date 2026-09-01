import { useState } from 'react';
import { Token as AstryxToken } from '@astryxdesign/core/Token';
import type { TokenProps as AstryxTokenProps, TokenColor, TokenSize } from '@astryxdesign/core/Token';
import { X } from 'lucide-react';

export type TokenProps = AstryxTokenProps;
export type { TokenColor, TokenSize };

function RemoveButton({ onRemove, label }: { onRemove: (e: React.MouseEvent) => void; label: string }) {
  const [isHovered, setIsHovered] = useState(false);

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 15,
        height: 15,
        borderRadius: '50%',
        border: 'none',
        backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.14)' : 'transparent',
        padding: 0,
        marginRight: -2,
        marginLeft: 2,
        cursor: 'pointer',
        color: 'inherit',
        opacity: isHovered ? 1 : 0.75,
        transition: 'background-color 0.15s ease, opacity 0.15s ease',
        flexShrink: 0,
      }}
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
