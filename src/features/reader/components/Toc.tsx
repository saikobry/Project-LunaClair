import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronDown, ChevronUp, ChevronRight, List } from 'lucide-react';
import { Outline, type OutlineItem } from '../../../shared/ui/Outline/Outline';
import { parseOutlineFromMarkdown } from '../../../shared/ui/Outline/parseOutlineFromMarkdown';

const collapseQuery = '@media (max-width: 1199px)';
const desktopQuery = '@media (min-width: 1200px)';

const styles = stylex.create({
  // Sticky Dropdown Header (< 1200px)
  mobileStickyHeader: {
    display: 'none',
    [collapseQuery]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      backgroundColor: 'var(--color-background-surface)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: 'var(--color-border)',
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 12,
      paddingRight: 12,
      width: '100%',
      boxSizing: 'border-box',
    },
  },
  mobileTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    width: '100%',
    minWidth: 0,
    justifyContent: 'space-between',
  },
  mobileTriggerLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
  },
  staticLabelText: {
    flexShrink: 0,
  },
  activeTitleText: {
    color: 'var(--color-accent)',
    fontWeight: 600,
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevronIcon: {
    flexShrink: 0,
  },
  mobileDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'var(--color-background-surface)',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
    boxShadow: 'var(--shadow-med)',
    maxHeight: '50vh',
    overflowY: 'auto',
    zIndex: 95,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 8,
    paddingBottom: 8,
    boxSizing: 'border-box',
  },
  mobileItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    fontSize: 13.5,
    lineHeight: 1.4,
    minHeight: 38,
    flexShrink: 0,
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    transition: 'all 0.15s ease',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
      borderLeftColor: 'var(--color-accent)',
    },
  },
  mobileItemActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    borderLeftColor: 'var(--color-accent)',
    fontWeight: 600,
  },

  // Desktop View (Overlay)
  desktopWrapper: {
    display: 'none',
    [desktopQuery]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      position: 'fixed',
      top: 80,
      right: 24,
      zIndex: 100,
      overflow: 'visible',
    },
  },
  desktopExpandedCard: {
    width: 240,
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    scrollbarWidth: 'none',
    scrollPaddingTop: 56,
    scrollPaddingBottom: 36,
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 14,
    padding: '14px 14px 12px 14px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    transition: 'all 0.2s ease',
  },
  desktopHeaderBtn: {
    position: 'sticky',
    top: -14,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 'calc(100% + 28px)',
    margin: '-14px -14px 10px -14px',
    padding: '10px 14px',
    borderWidth: 0,
    borderStyle: 'none',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
    borderRadius: '14px 14px 0 0',
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    boxSizing: 'border-box',
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  desktopHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  desktopHeaderChevron: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-disabled)',
    transition: 'color 0.15s ease',
  },
  miniTocContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 32,
    padding: '10px 5px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    userSelect: 'none',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    ':hover': {
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      borderColor: 'var(--color-accent)',
    },
  },
  miniTocHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 4,
    paddingBottom: 8,
    paddingLeft: 0,
    paddingRight: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
    borderRadius: 6,
    transition: 'color 0.15s ease, background-color 0.15s ease',
    ':hover': {
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-background-muted)',
    },
  },
  miniTocBars: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3.5,
    width: '100%',
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    scrollbarWidth: 'none',
  },
  miniBarWrapper: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: 7,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: 2,
    boxSizing: 'border-box',
    transition: 'background-color 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
  },
  miniBarWrapperActive: {
    backgroundColor: 'var(--color-accent-muted)',
  },
  miniBar: {
    display: 'block',
    height: 2,
    borderRadius: 1.5,
    // A graphic, so it takes a border role — the border scale is the app's
    // hairline/graphic vocabulary and the darkest step in it is the hover
    // emphasis (the wrapper already backgrounds itself on hover).
    backgroundColor: 'var(--color-border-emphasized)',
    opacity: 0.6,
    transition: 'all 0.2s ease',
    ':hover': {
      opacity: 1,
    },
  },
  miniBarActive: {
    height: 3,
    backgroundColor: 'var(--color-accent)',
    opacity: 1,
    boxShadow: '0 0 4px var(--color-accent)',
  },
});

interface TocProps {
  content?: string;
}

export function TocMobile({ content }: TocProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => {
    if (!content) return [];
    const parsed = parseOutlineFromMarkdown(content);
    return parsed.length > 0 ? parsed : [];
  }, [content]);

  const resolvedActiveId = activeId || items[0]?.id || '';
  const activeItem = useMemo(() => {
    return items.find((item) => item.id === resolvedActiveId) ?? items[0];
  }, [items, resolvedActiveId]);

  // Mobile scroll spy
  useEffect(() => {
    if (items.length === 0) return;

    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      const headingElements = items
        .map((item) => document.getElementById(item.id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) return;

      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      if (isAtBottom && items.length > 0) {
        const lastItem = items[items.length - 1];
        if (lastItem) {
          setActiveId(lastItem.id);
          return;
        }
      }

      let currentId = items[0]?.id ?? '';

      for (const el of headingElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 80) {
          currentId = el.id;
        } else {
          break;
        }
      }

      setActiveId(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  // Animate mobile dropdown entrance with GSAP
  useGSAP(() => {
    if (!dropdownOpen || !dropdownRef.current) return;
    gsap.fromTo(
      dropdownRef.current,
      { opacity: 0, y: -8, scaleY: 0.96, transformOrigin: 'top' },
      {
        opacity: 1,
        y: 0,
        scaleY: 1,
        duration: 0.18,
        ease: 'power2.out',
        clearProps: 'transform',
      },
    );
  }, { dependencies: [dropdownOpen] });

  // Autoscroll active item in mobile dropdown when opened
  useEffect(() => {
    if (!dropdownOpen || !resolvedActiveId || !dropdownRef.current) return;
    const activeEl = dropdownRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [dropdownOpen, resolvedActiveId]);

  const handleSelectSection = (id: string) => {
    setActiveId(id);
    setDropdownOpen(false);
    isClickScrollingRef.current = true;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 800);

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (items.length === 0) return null;

  return (
    <div {...stylex.props(styles.mobileStickyHeader)}>
      <button
        type="button"
        {...stylex.props(styles.mobileTrigger)}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-label="Table of contents menu"
      >
        <span {...stylex.props(styles.mobileTriggerLabel)}>
          <List size={16} style={{ flexShrink: 0 }} />
          <span {...stylex.props(styles.staticLabelText)}>On this page:</span>
          <span {...stylex.props(styles.activeTitleText)}>
            {activeItem?.label ?? 'Contents'}
          </span>
        </span>
        {dropdownOpen ? (
          <ChevronUp size={16} style={{ flexShrink: 0 }} />
        ) : (
          <ChevronDown size={16} style={{ flexShrink: 0 }} />
        )}
      </button>

      {dropdownOpen && (
        <div ref={dropdownRef} {...stylex.props(styles.mobileDropdown)}>
          {items.map((item) => {
            const isActive = item.id === activeItem?.id;
            return (
              <button
                key={item.id}
                type="button"
                data-active={isActive ? 'true' : undefined}
                {...stylex.props(styles.mobileItem, isActive && styles.mobileItemActive)}
                onClick={() => handleSelectSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniToc({
  items,
  activeId,
  onExpand,
  onSelectSection,
}: {
  items: OutlineItem[];
  activeId: string;
  onExpand: () => void;
  onSelectSection: (id: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  // GSAP springy entrance for MiniToc
  useGSAP(() => {
    if (!navRef.current) return;
    gsap.fromTo(
      navRef.current,
      { opacity: 0, scale: 0.88, transformOrigin: 'top right' },
      {
        opacity: 1,
        scale: 1,
        duration: 0.2,
        ease: 'back.out(1.4)',
        clearProps: 'transform',
      },
    );
  }, { scope: navRef });

  // Autoscroll active mini bar into view with vertical breathing room
  useEffect(() => {
    if (!activeId || !barsRef.current) return;
    const container = barsRef.current;
    const activeBar = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeBar) return;

    const containerRect = container.getBoundingClientRect();
    const barRect = activeBar.getBoundingClientRect();
    const margin = 16;

    if (barRect.top < containerRect.top + margin) {
      container.scrollTo({
        top: Math.max(0, container.scrollTop - (containerRect.top + margin - barRect.top)),
        behavior: 'smooth',
      });
    } else if (barRect.bottom > containerRect.bottom - margin) {
      container.scrollTo({
        top: container.scrollTop + (barRect.bottom - (containerRect.bottom - margin)),
        behavior: 'smooth',
      });
    }
  }, [activeId]);

  return (
    <nav
      ref={navRef}
      aria-label="Table of contents outline"
      {...stylex.props(styles.miniTocContainer)}
    >
      <button
        type="button"
        {...stylex.props(styles.miniTocHeaderBtn)}
        onClick={onExpand}
        title="Expand Table of Contents"
        aria-label="Expand Table of Contents"
      >
        <List size={14} />
      </button>
      <div ref={barsRef} {...stylex.props(styles.miniTocBars)}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const level = item.level ?? 1;
          const barWidth = level === 1 ? 16 : level === 2 ? 12 : 8;
          const barMarginLeft = level === 1 ? 0 : level === 2 ? 4 : 8;

          return (
            <button
              key={item.id}
              type="button"
              data-active={isActive ? 'true' : undefined}
              {...stylex.props(
                styles.miniBarWrapper,
                isActive && styles.miniBarWrapperActive,
              )}
              title={item.label}
              aria-label={item.label}
              onClick={() => onSelectSection(item.id)}
            >
              <span
                {...stylex.props(
                  styles.miniBar,
                  isActive && styles.miniBarActive,
                )}
                style={{
                  width: `${barWidth}px`,
                  marginLeft: `${barMarginLeft}px`,
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function TocDesktop({ content }: TocProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [activeId, setActiveId] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);
  const isClickScrollingRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => {
    if (!content) return [];
    const parsed = parseOutlineFromMarkdown(content);
    return parsed.length > 0 ? parsed : [];
  }, [content]);

  const resolvedActiveId = activeId || items[0]?.id || '';

  // GSAP smooth expand animation for desktop outline card
  useGSAP(() => {
    if (isMinimized || !cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, scale: 0.94, y: -6, transformOrigin: 'top right' },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.22,
        ease: 'power2.out',
        clearProps: 'transform',
      },
    );
  }, { dependencies: [isMinimized] });

  // Outside click listener to minimize expanded TOC card overlay
  useEffect(() => {
    if (isMinimized) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsMinimized(true);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isMinimized]);

  // Scroll spy to keep active section in sync for both full and miniature outline
  useEffect(() => {
    if (items.length === 0) return;

    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      const headingElements = items
        .map((item) => document.getElementById(item.id))
        .filter((el): el is HTMLElement => el !== null);

      if (headingElements.length === 0) return;

      const isAtBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60;

      if (isAtBottom && items.length > 0) {
        const lastItem = items[items.length - 1];
        if (lastItem) {
          setActiveId(lastItem.id);
          return;
        }
      }

      let currentId = items[0]?.id ?? '';

      for (const el of headingElements) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 80) {
          currentId = el.id;
        } else {
          break;
        }
      }

      setActiveId(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  // Auto-scroll the TOC card to keep the active section indicator / slider in view with breathing room
  useEffect(() => {
    if (isMinimized || !resolvedActiveId || !cardRef.current) return;

    const card = cardRef.current;
    const activeEl = card.querySelector<HTMLElement>('a[aria-current="true"]');
    if (!activeEl) return;

    const cardRect = card.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const topMargin = 56; // Header height + breathing room
    const bottomMargin = 36; // Bottom margin

    if (activeRect.top < cardRect.top + topMargin) {
      card.scrollTo({
        top: Math.max(0, card.scrollTop - (cardRect.top + topMargin - activeRect.top)),
        behavior: 'smooth',
      });
    } else if (activeRect.bottom > cardRect.bottom - bottomMargin) {
      card.scrollTo({
        top: card.scrollTop + (activeRect.bottom - (cardRect.bottom - bottomMargin)),
        behavior: 'smooth',
      });
    }
  }, [resolvedActiveId, isMinimized]);

  const handleSelectSection = (id: string) => {
    setActiveId(id);
    isClickScrollingRef.current = true;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 800);

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (items.length === 0) return null;

  const desktopNode = (
    <div {...stylex.props(styles.desktopWrapper)}>
      {isMinimized ? (
        <MiniToc
          items={items}
          activeId={resolvedActiveId}
          onExpand={() => setIsMinimized(false)}
          onSelectSection={handleSelectSection}
        />
      ) : (
        <div
          ref={cardRef}
          {...stylex.props(styles.desktopExpandedCard)}
        >
          <button
            type="button"
            {...stylex.props(styles.desktopHeaderBtn)}
            onClick={() => setIsMinimized(true)}
            title="Collapse Table of Contents"
            aria-label="Collapse Table of Contents"
          >
            <div {...stylex.props(styles.desktopHeaderTitle)}>
              <List size={14} />
              <span>On this page</span>
            </div>
            <div {...stylex.props(styles.desktopHeaderChevron)}>
              <ChevronRight size={15} />
            </div>
          </button>
          <Outline
            items={items}
            activeId={resolvedActiveId}
            onActiveIdChange={handleSelectSection}
            density="compact"
          />
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(desktopNode, document.body);
  }

  return desktopNode;
}
