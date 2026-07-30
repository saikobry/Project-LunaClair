import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import * as stylex from '@stylexjs/stylex';
import {
    TabList as AstryxTabList,
    Tab,
} from '@astryxdesign/core/TabList';
import type { TabListProps, TabProps } from '@astryxdesign/core/TabList';

export { Tab };
export type { TabListProps, TabProps };

const styles = stylex.create({
    wrapper: {
        position: 'relative',
        marginBottom: 20,
    },
    indicator: {
        position: 'absolute',
        zIndex: 2,
        pointerEvents: 'none',
        opacity: 0,
        backgroundColor: 'var(--color-accent)',
        borderRadius: '2px 2px 0 0',
        height: 3,
        bottom: 0,
    },
    astryxContainer: {
        position: 'relative',
        zIndex: 1,
    },
});

/**
 * LunaClair TabList — thin adapter over @astryxdesign/core TabList.
 * Renders a sliding bottom-underline accent indicator on the active tab.
 */
export function TabList({ value, hasDivider, ...props }: TabListProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const prevValueRef = useRef<string | undefined>(undefined);

    // Keep a ref to the latest value so the reposition closure
    // always reads the current value without needing it in dep arrays.
    // Updated in useEffect (not during render) to avoid ref mutation warnings.
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    // ── Reposition helper with rAF for reliable measurements ───────
    const reposition = (animate = false) => {
        if (!wrapperRef.current || !indicatorRef.current) return;

        const tabs = wrapperRef.current.querySelectorAll('[data-tab-value]');
        const activeTab = Array.from(tabs).find(
            (tab) => tab.getAttribute('data-tab-value') === valueRef.current,
        );
        if (!activeTab) return;

        const wrapperRect = wrapperRef.current.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        const left = tabRect.left - wrapperRect.left;
        const width = tabRect.width;
        const target = { left, width };

        if (!animate) {
            gsap.set(indicatorRef.current, { ...target, opacity: 1 });
        } else {
            gsap.set(indicatorRef.current, { opacity: 1 });
            gsap.to(indicatorRef.current, {
                ...target,
                duration: 0.28,
                ease: 'power3.out',
                overwrite: 'auto',
            });
        }
    };

    // ── Sliding bottom-underline indicator ─────────────────────────
    useGSAP(() => {
        if (!wrapperRef.current || !indicatorRef.current) return;

        const isFirstRun = prevValueRef.current === undefined;
        const hasChanged = prevValueRef.current !== value;
        prevValueRef.current = value;

        requestAnimationFrame(() => {
            reposition(!isFirstRun && hasChanged);
        });
    }, { dependencies: [value] });

    // ── ResizeObserver — reposition on resize without animation ────
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(() => reposition(false));
        });
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={wrapperRef} {...stylex.props(styles.wrapper)}>
            <div ref={indicatorRef} {...stylex.props(styles.indicator)} />
            <AstryxTabList
                value={value}
                hasDivider={hasDivider ?? false}
                {...props}
            />
        </div>
    );
}

TabList.displayName = 'TabList';
