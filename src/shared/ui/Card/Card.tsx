import { type ReactNode } from 'react';
import type { StyleXStyles } from '@stylexjs/stylex';
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
  /**
   * StyleX overrides applied to the card surface. Use this — not `className` —
   * when the card's own surface needs to change (e.g. a hover border): the
   * border lives on the card element, so styling a child cannot express it.
   */
  xstyle?: StyleXStyles;
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
  xstyle,
}: CardProps) {
  return (
    <AstryxCard
      width={width}
      height={height}
      maxWidth={maxWidth}
      minHeight={minHeight}
      xstyle={xstyle}
      className={className}
      style={{ overflow: 'visible', ...style }}
    >
      {children}
    </AstryxCard>
  );
}

Card.displayName = 'Card';
