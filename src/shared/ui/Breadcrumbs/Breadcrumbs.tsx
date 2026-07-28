import { type ReactNode } from 'react';
import {
  Breadcrumbs as AstryxBreadcrumbs,
  BreadcrumbItem as AstryxBreadcrumbItem,
} from '@astryxdesign/core/Breadcrumbs';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  /** Display label. */
  label: string;
  /** Optional icon element. */
  icon?: ReactNode;
  /** Click handler. If omitted, the item is rendered as the current page. */
  onClick?: () => void;
}

interface BreadcrumbsProps {
  /** Ordered list of breadcrumb items (home → deepest). */
  items: BreadcrumbItem[];
  /** Optional aria-label. @default 'Breadcrumb' */
  'aria-label'?: string;
}

/**
 * LunaClair Breadcrumbs — thin adapter over @astryxdesign/core Breadcrumbs.
 *
 * Maps a data-driven `BreadcrumbItem[]` array to Astryx's children-based
 * `<Breadcrumbs>` + `<BreadcrumbItem>` composition with clean text link
 * styling and custom click handlers.
 */
export function Breadcrumbs({
  items,
  'aria-label': ariaLabel = 'Breadcrumb',
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <AstryxBreadcrumbs
      label={ariaLabel}
      separator={<ChevronRight size={12} />}
      variant="default"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <AstryxBreadcrumbItem
            key={index}
            isCurrent={isLast}
            onClick={isLast ? undefined : item.onClick}
          >
            {item.label}
          </AstryxBreadcrumbItem>
        );
      })}
    </AstryxBreadcrumbs>
  );
}

Breadcrumbs.displayName = 'Breadcrumbs';
