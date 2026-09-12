import { type ReactNode } from 'react';
import * as stylex from '@stylexjs/stylex';

const mobileScreen = '@media (max-width: 768px)';

const styles = stylex.create({
  screen: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 32,
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    [mobileScreen]: {
      padding: '16px',
    },
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  description: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  breadcrumbHeaderHidden: {
    marginBottom: 16,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
});

export interface PageProps {
  /** Page title (rendered as h1). */
  title: string;
  /** Optional description below the title. */
  description?: string;
  /** Optional breadcrumb trail rendered above the title. */
  breadcrumb?: ReactNode;
  /** Action elements rendered in the header (buttons, etc.). */
  actions?: ReactNode;
  /** When true, visually hides the header while preserving the h1 for screen readers. */
  headerHidden?: boolean;
  /** Page content. */
  children: ReactNode;
}

/**
 * LunaClair Page — standardized layout container.
 *
 * Provides a consistent page shell with title, description, actions,
 * and content area. Features own their page content within children.
 * No search/filter/breadcrumb state — those belong in feature code.
 */
export function Page({
  title,
  description,
  breadcrumb,
  actions,
  headerHidden = false,
  children,
}: PageProps) {
  return (
    <div {...stylex.props(styles.screen)}>
      {breadcrumb && (
        <div {...stylex.props(headerHidden && styles.breadcrumbHeaderHidden)}>
          {breadcrumb}
        </div>
      )}
      {headerHidden ? (
        <h1 {...stylex.props(styles.srOnly)}>{title}</h1>
      ) : (
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerLeft)}>
            <h1 {...stylex.props(styles.title)}>{title}</h1>
            {description && (
              <p {...stylex.props(styles.description)}>{description}</p>
            )}
          </div>
          {actions && <div {...stylex.props(styles.actions)}>{actions}</div>}
        </div>
      )}
      <div {...stylex.props(styles.content)}>{children}</div>
    </div>
  );
}

Page.displayName = 'Page';
