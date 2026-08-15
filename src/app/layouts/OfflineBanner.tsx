import { useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Wifi, WifiOff } from 'lucide-react';

// Versioned key: bump the suffix if the stored `BannerPosition` shape ever
// changes — reads of older keys fall back to the default position (the
// shape-checking parse below ignores anything it can't validate).
const STORAGE_KEY = 'lunaclair:settings:offline-banner-pos:v1';

interface BannerPosition {
  side: 'left' | 'right';
  y: number;
}

/**
 * Global connectivity status indicator (app-shell chrome).
 *
 * Follows `navigator.onLine` and communicates state only:
 * - while offline → a persistent, draggable "Offline" pill that magnetically
 *   anchors to the left or right screen border when released, auto-collapsing
 *   to an icon-only badge after 4s (expands on hover)
 * - on recovery  → transient "You're back online" chip, auto-hides after ~3s
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [showRecovered, setShowRecovered] = useState(false);
  const wasOffline = useRef(false);

  const [savedPosition, setSavedPosition] = useState<BannerPosition>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.side === 'left' || parsed.side === 'right') && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return { side: 'right', y: 16 };
  });

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const collapseTimerRef = useRef<number | null>(null);

  // Connectivity events
  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => setIsOnline(true);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Recovery flash
  useEffect(() => {
    if (isOnline) {
      if (wasOffline.current) {
        setShowRecovered(true);
        const timer = window.setTimeout(() => setShowRecovered(false), 3000);
        return () => window.clearTimeout(timer);
      }
      setShowRecovered(false);
    } else {
      wasOffline.current = true;
      setShowRecovered(false);
    }
  }, [isOnline]);

  // Auto-collapse timer when offline
  useEffect(() => {
    if (!isOnline) {
      setIsCollapsed(false);
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => {
        setIsCollapsed(true);
      }, 4000);
    }
    return () => {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
    };
  }, [isOnline]);

  const showOffline = !isOnline;
  const visible = showOffline || showRecovered;

  // Don't expand when moving — stay in current collapsed/expanded state during drag
  const expanded = isHovered || !isCollapsed;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const banner = bannerRef.current;
    if (!banner) return;

    try {
      banner.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = banner.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    };
    setDragOffset({ x: rect.left, y: rect.top });
    setIsDragging(true);
    if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    const newX = dragStartRef.current.startX + deltaX;
    const newY = dragStartRef.current.startY + deltaY;

    setDragOffset({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    setIsDragging(false);

    try {
      bannerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const banner = bannerRef.current;
    const currentX = dragOffset?.x ?? dragStartRef.current.startX;
    const currentY = dragOffset?.y ?? dragStartRef.current.startY;
    const bannerWidth = banner?.offsetWidth ?? 110;
    const bannerHeight = banner?.offsetHeight ?? 32;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const centerX = currentX + bannerWidth / 2;
    const side: 'left' | 'right' = centerX < windowWidth / 2 ? 'left' : 'right';

    const minY = 16;
    const maxY = Math.max(minY, windowHeight - bannerHeight - 16);
    const clampedY = Math.max(minY, Math.min(maxY, currentY));
    const bottomDist = windowHeight - clampedY - bannerHeight;

    const newPos: BannerPosition = { side, y: Math.max(16, bottomDist) };
    setSavedPosition(newPos);
    setDragOffset(null);
    dragStartRef.current = null;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
    } catch {
      // ignore
    }

    if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = window.setTimeout(() => {
      setIsCollapsed(true);
    }, 3000);
  };

  const handlePointerEnter = () => {
    setIsHovered(true);
    setIsCollapsed(false);
    if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    if (!isOnline && !isDragging) {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = window.setTimeout(() => {
        setIsCollapsed(true);
      }, 3000);
    }
  };

  const getPositionStyles = (): React.CSSProperties => {
    if (isDragging && dragOffset) {
      return {
        left: `${dragOffset.x}px`,
        top: `${dragOffset.y}px`,
        right: 'auto',
        bottom: 'auto',
        transition: 'none',
        cursor: 'grabbing',
      };
    }

    const isLeft = savedPosition.side === 'left';
    return {
      left: isLeft ? 16 : 'auto',
      right: isLeft ? 'auto' : 16,
      bottom: `${savedPosition.y}px`,
      top: 'auto',
      transition:
        'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), right 0.35s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, transform 0.3s ease',
      cursor: 'grab',
    };
  };

  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={getPositionStyles()}
      {...stylex.props(
        styles.wrapper,
        visible && styles.wrapperVisible,
      )}
    >
      {showOffline ? (
        expanded ? (
          <div
            aria-label="You're offline. Your changes are saved locally. Drag to reposition."
            {...stylex.props(styles.pill, isDragging && styles.pillDragging)}
          >
            <WifiOff size={13} aria-hidden="true" {...stylex.props(styles.pillIcon)} />
            <span>Offline</span>
          </div>
        ) : (
          <div
            aria-label="You're offline. Hover or drag to expand."
            {...stylex.props(styles.pillCollapsed, isDragging && styles.pillDragging)}
            title="Offline (drag or hover to expand)"
          >
            <WifiOff size={13} aria-hidden="true" {...stylex.props(styles.pillIcon)} />
          </div>
        )
      ) : (
        <div {...stylex.props(styles.chip, styles.chipRecovered, isDragging && styles.pillDragging)}>
          <Wifi size={16} aria-hidden="true" />
          <span>You're back online</span>
        </div>
      )}
    </div>
  );
}

const styles = stylex.create({
  wrapper: {
    position: 'fixed',
    pointerEvents: 'auto',
    touchAction: 'none',
    userSelect: 'none',
    zIndex: 200,
    display: 'flex',
    opacity: 0,
    visibility: 'hidden',
    transform: 'scale(0.92)',
  },
  wrapperVisible: {
    opacity: 1,
    visibility: 'visible',
    transform: 'scale(1)',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 9999,
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
    fontSize: 11.5,
    fontWeight: 500,
    lineHeight: 1.4,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  pillCollapsed: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-warning-muted, var(--color-border))',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.14)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  pillDragging: {
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    transform: 'scale(1.05)',
  },
  pillIcon: {
    color: 'var(--color-warning)',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 9999,
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: 12.5,
    fontWeight: 500,
    lineHeight: 1.4,
    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
    whiteSpace: 'nowrap',
  },
  chipRecovered: {
    backgroundColor: 'var(--color-success-muted)',
    color: 'var(--color-on-success-muted)',
    borderColor: 'var(--color-success-border)',
  },
});
