import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

const NEAR_BOTTOM_THRESHOLD_PX = 64;

export interface UseAiAutoScrollOptions {
  isStreaming?: boolean;
}

export function useAiAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  _options: UseAiAutoScrollOptions = {},
) {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const wasNearBottomRef = useRef(true);

  // Check whether container is scrolled near bottom
  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = distanceToBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    setIsNearBottom(near);
    wasNearBottomRef.current = near;
    return near;
  }, [containerRef]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setIsNearBottom(true);
    wasNearBottomRef.current = true;
  }, [containerRef]);

  // Handle user scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      checkNearBottom();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, checkNearBottom]);

  // When actively streaming or messages change: only auto-scroll if user is near bottom
  const notifyContentUpdated = useCallback(() => {
    if (wasNearBottomRef.current) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [containerRef]);

  return {
    isNearBottom,
    scrollToBottom,
    notifyContentUpdated,
    checkNearBottom,
  };
}
