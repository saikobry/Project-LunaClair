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

/**
 * Base skeleton block — thin adapter over @astryxdesign/core Skeleton.
 * Maps pixel-based borderRadius to Astryx design-token radius scale.
 */
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

// ── Card Skeleton ─────────────────────────────────────────

const cardStyles = stylex.create({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    background: 'var(--color-background-surface)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
});

function CardSkeleton() {
  return (
    <div {...stylex.props(cardStyles.card)} aria-label="Loading card">
      <div {...stylex.props(cardStyles.row)}>
        <SkeletonBlock width="60%" height={18} borderRadius={6} />
        <SkeletonBlock width={48} height={18} borderRadius={6} />
      </div>
      <SkeletonBlock width="100%" height={32} borderRadius={6} />
      <div {...stylex.props(cardStyles.meta)}>
        <SkeletonBlock width={14} height={14} borderRadius={4} />
        <SkeletonBlock width={100} height={12} borderRadius={6} />
      </div>
      <div {...stylex.props(cardStyles.actions)}>
        <SkeletonBlock width={32} height={32} borderRadius={8} />
        <SkeletonBlock width={32} height={32} borderRadius={8} />
        <SkeletonBlock width={32} height={32} borderRadius={8} />
        <SkeletonBlock width={32} height={32} borderRadius={8} />
        <SkeletonBlock width={32} height={32} borderRadius={8} />
      </div>
    </div>
  );
}

// ── Grid Skeleton (multiple cards) ────────────────────────

const gridStyles = stylex.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
});

export function CardGridSkeleton({
  count = 6,
  variant = 'grid',
}: {
  count?: number;
  /** 'grid' (multi-column) or 'list' (single column per row). */
  variant?: 'grid' | 'list';
}) {
  return (
    <div
      {...stylex.props(variant === 'list' ? gridStyles.list : gridStyles.grid)}
      role="status"
      aria-label="Loading cards"
    >
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Workspace Skeleton ────────────────────────────────────

const workspaceStyles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tabBar: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 0,
  },
  tab: {
    width: 80,
    height: 36,
    borderRadius: '8px 8px 0 0',
  },
});

export function WorkspaceSkeleton() {
  return (
    <div {...stylex.props(workspaceStyles.container)} role="status" aria-label="Loading workspace">
      <div {...stylex.props(workspaceStyles.header)}>
        <SkeletonBlock width="45%" height={28} borderRadius={6} />
        <SkeletonBlock width="30%" height={14} borderRadius={6} />
      </div>
      <div {...stylex.props(workspaceStyles.tabBar)}>
        <SkeletonBlock width={80} height={36} {...stylex.props(workspaceStyles.tab)} />
        <SkeletonBlock width={80} height={36} {...stylex.props(workspaceStyles.tab)} />
        <SkeletonBlock width={80} height={36} {...stylex.props(workspaceStyles.tab)} />
      </div>
    </div>
  );
}
