import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface AnimatedTabPanelProps {
  /** Key that triggers the entrance animation when it changes */
  activeKey: string;
  /** Content to render inside the panel */
  children: ReactNode;
}

/**
 * Tab panel wrapper that animates content entrance when `activeKey` changes.
 * Uses GSAP for a smooth opacity fade + vertical slide-up on each tab switch.
 *
 * Renders a `<div role="tabpanel">` with proper ARIA attributes for accessibility.
 */
export function AnimatedTabPanel({ activeKey, children }: AnimatedTabPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const panel = panelRef.current;
    if (!panel) return;

    gsap.fromTo(
      panel,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' },
    );
  }, { dependencies: [activeKey] });

  return (
    <div
      ref={panelRef}
      role="tabpanel"
      id={`panel-${activeKey}`}
      aria-labelledby={activeKey}
    >
      {children}
    </div>
  );
}

export type { AnimatedTabPanelProps };
