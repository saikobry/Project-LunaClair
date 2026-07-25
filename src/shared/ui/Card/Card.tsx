import { type ReactNode } from 'react';
import { Card as AstryxCard } from '@astryxdesign/core/Card';

export interface CardProps {
  /** Card content. */
  children?: ReactNode;
  /** Width. Numbers = pixels, strings = CSS value. */
  width?: string | number;
  /** Height. Numbers = pixels, strings = CSS value. */
  height?: string | number;
  /** Max width. Numbers = pixels, strings = CSS value. */
  maxWidth?: string | number;
  /** Min height. Numbers = pixels, strings = CSS value. */
  minHeight?: string | number;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
}

/**
 * LunaClair Card — thin adapter over @astryxdesign/core Card.
 *
 * Provides a themed surface container with Astryx spacing, border,
 * and background tokens. All Astryx accessibility and layout
 * capabilities come through transparently.
 */
export function Card({
  children,
  width,
  height,
  maxWidth,
  minHeight,
  className,
  style,
}: CardProps) {
  return (
    <AstryxCard
      width={width}
      height={height}
      maxWidth={maxWidth}
      minHeight={minHeight}
      className={className}
      style={style}
    >
      {children}
    </AstryxCard>
  );
}

Card.displayName = 'Card';
