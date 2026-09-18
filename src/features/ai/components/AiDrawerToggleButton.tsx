import * as stylex from '@stylexjs/stylex';
import { Sparkles } from 'lucide-react';
import { Button } from '../../../shared/ui/Button/Button';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';

const styles = stylex.create({
  wrapper: {
    position: 'relative',
    display: 'inline-flex',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: 'var(--color-accent)',
    border: '2px solid var(--color-background-surface)',
  },
});

export interface AiDrawerToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  isStreaming?: boolean;
  hasUnread?: boolean;
}

/**
 * Workspace AI toggle — a shared secondary `Button` matching the Source /
 * Share / Export actions beside it (icon-only under 640px), with the accent
 * active triple while the drawer is open. The streaming/unread dot is kept
 * for callers that report background generation state.
 */
export function AiDrawerToggleButton({
  isOpen,
  onToggle,
  isStreaming = false,
  hasUnread = false,
}: AiDrawerToggleButtonProps) {
  const isCompact = useMediaQuery('(max-width: 640px)');
  const showBadge = isStreaming || (!isStreaming && hasUnread && !isOpen);

  return (
    <span {...stylex.props(styles.wrapper)}>
      <Button
        label="AI Assistant"
        variant="secondary"
        icon={<Sparkles size={15} />}
        isIconOnly={isCompact}
        onClick={onToggle}
        aria-expanded={isOpen}
        style={
          isOpen
            ? {
                color: 'var(--color-accent)',
                borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
                backgroundColor: 'var(--color-overlay-hover)',
              }
            : undefined
        }
      >
        AI Assistant
      </Button>
      {showBadge && (
        <span
          {...stylex.props(styles.badge)}
          aria-label={isStreaming ? 'AI is currently generating' : 'New unread AI response'}
        />
      )}
    </span>
  );
}
