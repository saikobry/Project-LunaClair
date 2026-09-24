import { useLayoutEffect, useRef, type RefObject } from 'react';
import * as stylex from '@stylexjs/stylex';
import gsap from 'gsap';
import { ChevronRight } from 'lucide-react';
import type { QuestionDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { QuestionDifficulty } from '../../../domain/quiz/models/Question';
import { Button } from '../../../shared/ui/Button/Button';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { TagInput } from '../../../shared/ui/TagInput/TagInput';
import { mergeTags, normalizeTags, splitTagInput, tagKey } from '../../../shared/utils/tags';

const styles = stylex.create({
    drawerContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginTop: 4,
        paddingTop: 8,
        borderTop: '1px solid var(--color-border)',
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: 'var(--color-accent)',
        display: 'inline-block',
        marginLeft: 4,
    },
    drawerBody: {
        overflow: 'hidden',
        width: '100%',
        height: 0,
        opacity: 0,
    },
    drawerInner: {
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
});

interface QuizCanvasAnswerMetadataDrawerProps {
    item: QuestionDraft;
    onChange: (patch: Partial<QuestionDraft>) => void;
    /**
     * Open state owned by `QuizCanvasQuestionCard` — its root onClick resets
     * the drawer to closed on activation (the event that owns the change),
     * and a drag (which flips `effectiveIsActive` while `isActive` stays true)
     * keeps the drawer open through its collapse/re-expand cycle.
     */
    isDrawerOpen: boolean;
    onToggle: () => void;
    /**
     * Shared set of tempIds with an in-flight GSAP height tween (owned by
     * `QuizCanvasQuestionList`). While this drawer animates, its tempId is
     * registered so the list's wrapper ResizeObserver takes the cheap
     * frame-synced instant-push branch instead of settling (and re-rendering)
     * the whole canvas every frame. Optional so the component stays
     * self-sufficient.
     */
    heightAnimRef?: RefObject<Set<string>>;
}

/**
 * Nested "Answer Feedback & Metadata" drawer of a quiz canvas question card —
 * difficulty, explanation, and tags, with a GSAP height animation.
 *
 * Lives inside the card's active body, so it unmounts whenever the card
 * collapses (inactivation or a drag); its own unmount cleanup kills any
 * in-flight tween and releases the height-anim registration so a collapsed
 * card's accordion tween is never blocked.
 */
export function QuizCanvasAnswerMetadataDrawer({
    item,
    onChange,
    isDrawerOpen,
    onToggle,
    heightAnimRef,
}: QuizCanvasAnswerMetadataDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    /** Last drawer node + open state the animation ran against — detects toggles and re-mounts (card collapsed mid-open). */
    const prevDrawerRef = useRef<{ el: HTMLDivElement | null; open: boolean }>({ el: null, open: false });

    const hasMetadata = Boolean(item.explanation?.trim()) || (item.tags ?? []).length > 0;

    // A plain layout effect (NOT `useGSAP` with deps): `useGSAP` reverts its
    // previous context on every dependency change, which would reset the drawer's
    // inline `height` back to the stylesheet's 0 before the close tween starts —
    // snapping it shut instead of gliding. This effect animates from the real
    // current state in both directions.
    useLayoutEffect(() => {
        const el = drawerRef.current;
        if (!el) return;
        const prev = prevDrawerRef.current;
        prevDrawerRef.current = { el, open: isDrawerOpen };

        // Nothing actually changed (StrictMode double-run, unrelated re-render).
        if (prev.el === el && prev.open === isDrawerOpen) return;
        // A fresh drawer node (initial mount or remount after a collapse) already
        // renders closed via the stylesheet — only animate it when it (re)mounted
        // while marked open (card collapsed mid-open, then re-expanded).
        if (prev.el !== el && !isDrawerOpen) return;

        // Register this animation in the list's in-flight-tween set so the canvas
        // wrapper ResizeObserver takes the cheap frame-synced push branch (no
        // React re-render) instead of settling the whole canvas every frame — that
        // settle-per-frame is what dropped frames while this drawer animates.
        // Released when the tween finishes or is killed.
        const heightAnim = heightAnimRef?.current;
        const release = () => heightAnim?.delete(item.tempId);

        // Kill any in-flight tween on the drawer BEFORE registering the new one:
        // the kill fires the old tween's `onInterrupt` → `release()` synchronously,
        // which would otherwise delete the registration the new tween just added
        // (leaving the close animation unprotected → per-frame settles → drops).
        gsap.killTweensOf(el);
        heightAnim?.add(item.tempId);

        if (isDrawerOpen) {
            // Animate 0 → the measured content height, then hand off to inline
            // `height: auto`. GSAP's `height: 'auto'` end-value is usually paired
            // with `clearProps: 'height'` — but the stylesheet pins `drawerBody`
            // at `height: 0`, so clearing the inline height re-applies 0 and the
            // drawer snaps shut the instant the tween finishes. Inline `auto` (set
            // on complete) wins over the stylesheet, so the drawer stays open and
            // can keep growing as content changes (e.g. typing in the explanation
            // textarea).
            el.style.height = 'auto';
            const openHeight = el.scrollHeight;
            el.style.height = '';
            gsap.fromTo(
                el,
                { height: 0, opacity: 0 },
                {
                    height: openHeight,
                    opacity: 1,
                    duration: 0.35,
                    ease: 'power2.out',
                    onComplete: () => {
                        el.style.height = 'auto';
                        release();
                    },
                    onInterrupt: release,
                },
            );
        } else {
            gsap.to(el, {
                height: 0,
                opacity: 0,
                duration: 0.25,
                ease: 'power2.in',
                onComplete: release,
                onInterrupt: release,
            });
        }
    }, [isDrawerOpen, heightAnimRef, item.tempId]);

    // Unmount (the card collapsed mid-animation or was removed): kill the tween
    // and release the height-anim registration immediately so it can't keep
    // blocking the accordion collapse tween. Deps are stable for this drawer's
    // lifetime, so this cleanup runs on unmount only.
    useLayoutEffect(() => {
        // Capture the stable ref values now — the cleanup must not re-read them.
        const el = drawerRef.current;
        const heightAnim = heightAnimRef?.current;
        return () => {
            if (el) gsap.killTweensOf(el);
            heightAnim?.delete(item.tempId);
        };
    }, [heightAnimRef, item.tempId]);

    return (
        <div {...stylex.props(styles.drawerContainer)}>
            <Button
                label="Answer Feedback & Metadata"
                variant="ghost"
                icon={
                    <ChevronRight
                        size={14}
                        style={{
                            transform: isDrawerOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    />
                }
                onClick={onToggle}
                aria-expanded={isDrawerOpen}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Answer Feedback & Metadata
                    {hasMetadata && (
                        <span {...stylex.props(styles.activeDot)} title="Metadata populated" />
                    )}
                </span>
            </Button>

            <div ref={drawerRef} {...stylex.props(styles.drawerBody)}>
                <div {...stylex.props(styles.drawerInner)}>
                    <div {...stylex.props(styles.fieldGroup)}>
                        <span {...stylex.props(styles.fieldLabel)}>Difficulty</span>
                        <SegmentedControl
                            value={item.difficulty}
                            onChange={(val: string) => onChange({ difficulty: val as QuestionDifficulty })}
                            label="Difficulty"
                            size="sm"
                        >
                            <SegmentedControlItem value="easy" label="Easy" />
                            <SegmentedControlItem value="medium" label="Medium" />
                            <SegmentedControlItem value="hard" label="Hard" />
                        </SegmentedControl>
                    </div>

                    <div {...stylex.props(styles.fieldGroup)}>
                        <span {...stylex.props(styles.fieldLabel)}>
                            Answer Feedback / Explanation
                        </span>
                        <TextArea
                            label="Answer Feedback / Explanation"
                            labelHidden
                            value={item.explanation ?? ''}
                            onChange={(val) => onChange({ explanation: val })}
                            placeholder="Explanation shown to students after answering…"
                            rows={3}
                        />
                    </div>

                    <div {...stylex.props(styles.fieldGroup)}>
                        <TagInput
                            label="Tags"
                            tags={item.tags ?? []}
                            onChange={(tags) => onChange({ tags })}
                            size="sm"
                            placeholder="Type a tag and press Enter…"
                            splitInput={splitTagInput}
                            mergeTags={mergeTags}
                            tagKey={tagKey}
                            normalizeTags={(tags) => normalizeTags(tags) ?? []}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

QuizCanvasAnswerMetadataDrawer.displayName = 'QuizCanvasAnswerMetadataDrawer';
