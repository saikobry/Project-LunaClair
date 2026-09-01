import * as stylex from '@stylexjs/stylex';
import { Skeleton as AstryxSkeleton } from '@astryxdesign/core/Skeleton';
import type { SkeletonRadius } from '@astryxdesign/core/Skeleton';

/** Map a pixel borderRadius to the closest Astryx SkeletonRadius token. */
function mapRadius(borderRadius: string | number): SkeletonRadius {
  if (borderRadius === 'rounded' || borderRadius === '50%') return 'rounded';
  const px = typeof borderRadius === 'number' ? borderRadius : parseInt(String(borderRadius), 10);
  if (Number.isNaN(px) || px <= 0) return 'none';
  if (px <= 4) return 1;
  if (px <= 8) return 2;
  if (px <= 12) return 3;
  return 'rounded';
}

function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}) {
  return (
    <AstryxSkeleton
      width={width}
      height={height}
      radius={mapRadius(borderRadius)}
      style={style}
    />
  );
}

const questionStyles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 24,
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    background: 'var(--color-background-surface)',
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  choice: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
});

export function QuestionSkeleton() {
  return (
    <div {...stylex.props(questionStyles.container)} role="status" aria-label="Loading question">
      <div {...stylex.props(questionStyles.progress)}>
        <SkeletonBlock width={80} height={12} borderRadius={6} />
        <div {...stylex.props(questionStyles.bar)}>
          <SkeletonBlock width="100%" height={6} borderRadius={3} />
        </div>
      </div>
      <SkeletonBlock width="90%" height={20} borderRadius={6} />
      <div {...stylex.props(questionStyles.choices)}>
        <div {...stylex.props(questionStyles.choice)}>
          <SkeletonBlock width={18} height={18} borderRadius={4} />
          <SkeletonBlock width="75%" height={14} borderRadius={6} />
        </div>
        <div {...stylex.props(questionStyles.choice)}>
          <SkeletonBlock width={18} height={18} borderRadius={4} />
          <SkeletonBlock width="60%" height={14} borderRadius={6} />
        </div>
        <div {...stylex.props(questionStyles.choice)}>
          <SkeletonBlock width={18} height={18} borderRadius={4} />
          <SkeletonBlock width="70%" height={14} borderRadius={6} />
        </div>
        <div {...stylex.props(questionStyles.choice)}>
          <SkeletonBlock width={18} height={18} borderRadius={4} />
          <SkeletonBlock width="55%" height={14} borderRadius={6} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <SkeletonBlock width={100} height={36} borderRadius={8} />
      </div>
    </div>
  );
}
