import { useState, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronUp, List } from 'lucide-react';
import { Outline, parseOutlineFromMarkdown } from '@astryxdesign/core/Outline';

const mobileQuery = '@media (max-width: 768px)';
const desktopQuery = '@media (min-width: 769px)';

const styles = stylex.create({
  // Mobile Sticky Header
  mobileStickyHeader: {
    display: 'none',
    [mobileQuery]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      backgroundColor: 'var(--color-background-surface, #ffffff)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: 'var(--color-border)',
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 16,
      paddingRight: 16,
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
    justifyContent: 'space-between',
  },
  mobileTriggerLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeTitleText: {
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
  mobileDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'var(--color-background-surface, #ffffff)',
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
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    transition: 'all 0.15s ease',
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

  // Desktop View
  desktopWrapper: {
    display: 'none',
    [desktopQuery]: {
      display: 'block',
      width: 220,
      flexShrink: 0,
      position: 'sticky',
      top: 80,
      alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
    },
  },
});

interface TocProps {
  content?: string;
}

export function TocMobile({ content }: TocProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');

  const items = useMemo(() => {
    if (!content) return [];
    const parsed = parseOutlineFromMarkdown(content);
    return parsed.length > 0 ? parsed : [];
  }, [content]);

  const resolvedActiveId = activeId || items[0]?.id || '';
  const activeItem = useMemo(() => {
    return items.find((item) => item.id === resolvedActiveId) ?? items[0];
  }, [items, resolvedActiveId]);

  const handleSelectSection = (id: string) => {
    setActiveId(id);
    setDropdownOpen(false);

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
          <List size={16} />
          <span>On this page:</span>
          <span {...stylex.props(styles.activeTitleText)}>
            {activeItem?.label ?? 'Contents'}
          </span>
        </span>
        {dropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {dropdownOpen && (
        <div {...stylex.props(styles.mobileDropdown)}>
          {items.map((item) => {
            const isActive = item.id === activeItem?.id;
            return (
              <button
                key={item.id}
                type="button"
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

export function TocDesktop({ content }: TocProps) {
  const [activeId, setActiveId] = useState<string>('');

  const items = useMemo(() => {
    if (!content) return [];
    const parsed = parseOutlineFromMarkdown(content);
    return parsed.length > 0 ? parsed : [];
  }, [content]);

  const resolvedActiveId = activeId || items[0]?.id || '';

  if (items.length === 0) return null;

  return (
    <div {...stylex.props(styles.desktopWrapper)}>
      <Outline
        items={items}
        activeId={resolvedActiveId}
        onActiveIdChange={setActiveId}
        label="On this page"
        density="compact"
      />
    </div>
  );
}

export default function Toc({ content }: TocProps) {
  return (
    <>
      <TocMobile content={content} />
      <TocDesktop content={content} />
    </>
  );
}
