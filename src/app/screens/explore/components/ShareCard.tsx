import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Check, Copy, Download, Eye, Sparkles, User } from 'lucide-react';
import { Card } from '../../../../shared/ui/Card/Card';
import type { ExploreContentItem } from '../../../../features/discovery/explore.types';
import { styles } from '../styles/shareCard.stylex';

export interface ShareCardProps {
  item: ExploreContentItem;
  /** This share is mid-clone. */
  isBusy: boolean;
  onOpen: (shareId: string) => void;
  onClone: (shareId: string) => void;
  /**
   * Opens the local material a cloned share became. Required, not optional:
   * an `isInLibrary` card must not fall back to a disabled Clone button, which
   * is the dead end this next step replaces.
   */
  onOpenInLibrary: (materialId: string) => void;
}

/** One published `.lcpack` share: identity, stats, and its open/clone actions. */
export function ShareCard({ item, isBusy, onOpen, onClone, onOpenInLibrary }: ShareCardProps) {
  /**
   * A cloned share's footer action is "Open in library" — the local material
   * id comes from the same `originShareId` lookup that set `isInLibrary`, so
   * this is defined exactly when the share is in the library.
   */
  const libraryMaterialId = item.isInLibrary ? item.libraryMaterialId : undefined;

  /**
   * Badge pill colors — `MaterialCard`'s per-instance inline triple (bg/border
   * on the hue's alpha, text in the full hue). Static here, so they live in
   * one record instead of being inlined per branch.
   */
  const badgeColors: Record<string, CSSProperties> = {
    verified: {
      backgroundColor: 'var(--color-accent-muted)',
      borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
      color: 'var(--color-accent)',
    },
    community: {
      backgroundColor: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
      borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)',
      color: 'var(--color-success)',
    },
    inLibrary: {
      backgroundColor: 'var(--color-accent-muted)',
      borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
      color: 'var(--color-accent)',
    },
  };
  /**
   * Whole-card pointer affordance: body clicks open the share. Every inner
   * control is a real `<button>` that stops propagation itself — the `closest`
   * guard below is the backstop, so a missed stop can never double-fire.
   *
   * Deliberately no `role="button"` on the shell: nested buttons inside a
   * button role is invalid ARIA. Keyboard and AT users open the share through
   * the title button — one control per action, and the focused control is what
   * wears the ring. Same shape as `MaterialCard`'s shell.
   */
  const handleCardOpen = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button, a, input, textarea, select, [role="menu"], [role="dialog"]')
    )
      return;
    onOpen(item.id);
  };

  return (
    <Card xstyle={styles.cardHoverBorder}>
      <div
        {...stylex.props(styles.card, styles.clickableCard)}
        onClick={handleCardOpen}
      >
        {/* Header: title — the one keyboard/AT open path, like MaterialCard. */}
        <h3 {...stylex.props(styles.cardTitle)}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            {...stylex.props(styles.cardTitleButton)}
          >
            {item.title}
          </button>
        </h3>

        {/* Byline: author left, stats right — one quiet meta line under the title. */}
        <div {...stylex.props(styles.bylineRow)}>
          <div {...stylex.props(styles.bylineAuthor)}>
            <User size={12} />
            <span>{item.author ?? 'Community upload'}</span>
          </div>
          <div {...stylex.props(styles.bylineStats)}>
            <span
              {...stylex.props(styles.metaItem)}
              aria-label={`${item.downloadCount} ${item.downloadCount === 1 ? 'download' : 'downloads'}`}
              title="Downloads"
            >
              <Download size={12} />
              {item.downloadCount}
            </span>
            <span
              {...stylex.props(styles.metaItem)}
              aria-label={`${item.viewCount} ${item.viewCount === 1 ? 'view' : 'views'}`}
              title="Views"
            >
              <Eye size={12} />
              {item.viewCount}
            </span>
          </div>
        </div>

        {/* Empty description keeps its reserved slot with a quiet placeholder. */}
        <p
          {...stylex.props(
            styles.cardDescription,
            item.description ? undefined : styles.descriptionEmpty,
          )}
        >
          {item.description ?? 'No description provided'}
        </p>

        {/* Bottom pinned badges — MaterialCard's membership-row slot, so grid rows align.
            Pills use MaterialCard's `badgeButton` geometry + inline color triple. */}
        <div {...stylex.props(styles.badgeRow)}>
          {item.isVerified ? (
            <span
              {...stylex.props(styles.badgeButton)}
              style={badgeColors.verified}
            >
              <Sparkles size={10} />
              <span {...stylex.props(styles.badgeLabel)}>Verified Course</span>
            </span>
          ) : (
            <span {...stylex.props(styles.badgeButton)} style={badgeColors.community}>
              <span {...stylex.props(styles.badgeLabel)}>Community</span>
            </span>
          )}
          {item.isInLibrary && (
            <span
              {...stylex.props(styles.badgeButton)}
              style={badgeColors.inLibrary}
            >
              <Check size={10} />
              <span {...stylex.props(styles.badgeLabel)}>In My Library</span>
            </span>
          )}
        </div>

        <div {...stylex.props(styles.cardFooter)}>
          <div {...stylex.props(styles.footerActions)}>
            {libraryMaterialId ? (
              <button
                type="button"
                aria-label={`Open ${item.title} in your library`}
                {...stylex.props(styles.actionPill)}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInLibrary(libraryMaterialId);
                }}
              >
                <BookOpen size={12} aria-hidden="true" />
                Open in library
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Clone ${item.title} to your library`}
                aria-busy={isBusy}
                disabled={isBusy}
                {...stylex.props(styles.actionPill, isBusy ? styles.actionPillBusy : undefined)}
                onClick={(e) => {
                  e.stopPropagation();
                  onClone(item.id);
                }}
              >
                <Copy size={12} aria-hidden="true" />
                Clone to Library
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ShareCard;
