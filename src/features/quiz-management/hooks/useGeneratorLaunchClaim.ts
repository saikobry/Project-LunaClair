import { useCallback, useEffect, useRef, useState } from 'react';

import type { MaterialWorkspaceTab } from '../../../app/routing/routing';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';

/**
 * A one-shot request to open the Question Bank's AI generator for a material, plus the way
 * back to the surface that asked for it.
 *
 * This exists because a cross-tab handoff needs a return path, and the workspace's only URL
 * state is `?tab=`. Encoding "the dialog is open" in the URL would be a lie: a dialog is not a
 * destination, so a link could not restore it, and Back would have to un-open it. The intent
 * is therefore **in-memory and transient** — it is retired the moment the surface that acts on
 * it has claimed it, and a fresh page load (including a deep link) starts with no intent at
 * all, so nothing fires spuriously.
 */
export interface GeneratorLaunchIntent {
    /** Material whose Question Bank the generator writes into. */
    materialId: string;
    /** Question types the generator's type control opens with selected. */
    requestedTypes: readonly QuestionType[];
    /** Where the user is offered a way back once the batch is saved. */
    returnTo: { tab: MaterialWorkspaceTab; label: string };
}

/**
 * The workspace-held half of the handoff, threaded down to the Bank as one prop so the pending
 * request and the single command that retires it cannot be passed apart.
 *
 * Ownership is the workspace screen's, deliberately: the intent is a one-shot command scoped to
 * one material's workspace (armed by the Flashcards tab, acted on by the Question Bank), not a
 * persistent cross-cutting mode, so it is state on the screen rather than a channel on the app
 * shell. `FocusModeProvider` is the counter-example that shows why — that holds a mode that
 * outlives any single route, which is exactly what this does not.
 */
export interface GeneratorLaunchChannel {
    /** The pending request, or `null`. Read it to know what a launch asked for. */
    intent: GeneratorLaunchIntent | null;
    /**
     * Retires **`intent` itself** — and only that one. Passing the intent rather than emptying
     * the channel blindly is what makes supersession safe: a dialog that was already replaced
     * by a newer launch must not be able to clear the launch that replaced it, and the owner is
     * the only party that knows which intent is currently armed. An implementation compares the
     * target against what it holds and does nothing when they differ.
     *
     * Must be stable across renders (a `useCallback` at the owner) — it is an effect
     * dependency. Callers must invoke it from an effect or an event handler, never during
     * render: clearing the owner's state mid-render is a cross-component render-phase update,
     * which React rejects.
     */
    onRetire: (intent: GeneratorLaunchIntent) => void;
}

export interface GeneratorLaunchClaim {
    /** Open the generator — the Bank's own "Generate with AI" path. */
    open: () => void;
    /** Close the generator. Also retires the latched claim, so a launch can never re-open it. */
    close: () => void;
    /**
     * Close and return to the tab the launch came from. A no-op when the Bank opened the
     * dialog itself, because there is nowhere to return to.
     */
    returnToLauncher: () => void;
    isOpen: boolean;
    /** The launcher's requested types, or `undefined` for the Bank's mixed default. */
    initialTypes: readonly QuestionType[] | undefined;
    /** The launcher's return label, or `undefined` when there is no launch or no handler. */
    returnLabel: string | undefined;
}

/**
 * Owns the generator dialog's open state for one material, including the **launch handoff** a
 * study surface (Flashcards) can send it.
 *
 * The launch is **one-shot**, and it is spent in two ordered steps:
 *
 * 1. **LATCH.** The claim is taken during render (the guarded pattern `useVisitedTabs` uses)
 *    and the claimed intent is copied into this hook's own state. The latch is what the dialog
 *    is configured from — `initialTypes` and the return label are read from it, never from the
 *    channel — so the claim is what makes the dialog correct on the first paint after the
 *    handoff rather than a frame later.
 * 2. **RETIRE.** An effect keyed on the *latched claim* then asks the owner to retire it.
 *
 * The effect has to key on the latch rather than on an "unclaimed" flag to exist at all: the
 * render that takes the claim calls `setState` during render, so React re-renders this hook
 * before committing and the flag is already `false` by the time any effect is registered. Keyed
 * on the latch, the effect runs on the render that commits, i.e. *after* the dialog is already
 * open and configured — which is the whole point of the ordering. Retiring earlier (during the
 * claim, or by clearing the latch) would empty the channel and close the dialog on the same
 * commit, so the latch is load-bearing, not bookkeeping.
 *
 * Retirement is asked for rather than written into the owner mid-render, because emptying the
 * owner's state during render is a cross-component render-phase update, which React rejects.
 *
 * `close()` remains, as the **idempotent** fallback: it retires the latched claim too, so a
 * launch is spent whichever way the user leaves (cancel, save, or the way back) even if the
 * effect has not run, and closing a dialog opened with no claim at all retires nothing. See
 * `components/__tests__/QuestionBankTab.test.tsx`, which pins all of it.
 */
export function useGeneratorLaunchClaim(
    materialId: string,
    launch: GeneratorLaunchChannel,
    onReturnToTab?: (tab: MaterialWorkspaceTab) => void,
): GeneratorLaunchClaim {
    const { intent, onRetire } = launch;
    const [claimed, setClaimed] = useState<GeneratorLaunchIntent | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Guarded render-phase claim, as `useVisitedTabs`. An intent addressed to another material
    // is left alone rather than consumed — the user may still be walking to it — and the owner
    // is what scopes an intent to a material in the first place, so nothing here has to expire it.
    if (intent !== null && intent.materialId === materialId && claimed === null) {
        setClaimed(intent);
        setIsOpen(true);
    }

    // Retirement is per-claim and happens at most once. The ref is the guarantee, not the
    // caller's callback identity: `onRetire` is only *expected* to be reference-stable, and a
    // consumer that re-creates it every render re-registers the effect every render — which
    // without this guard would re-request retirement forever. It is cleared with the latch, so
    // re-arming the same intent object later is retired in its own right.
    const retiredClaimRef = useRef<GeneratorLaunchIntent | null>(null);
    const retire = useCallback(
        (claim: GeneratorLaunchIntent) => {
            if (retiredClaimRef.current === claim) return;
            retiredClaimRef.current = claim;
            onRetire(claim);
        },
        [onRetire],
    );

    /**
     * The commit-time retirement — step 2 of the two-step handoff, and the reason the latch
     * exists at all. It runs after the claim has committed, so the dialog is already open and
     * configured. What it hands back is **the channel's own pending intent** rather than this
     * hook's private latch state: the request being retired is the owner's, so the owner is
     * told about its own object and the latch is only ever the trigger.
     *
     * `intent === claimed` is the real condition, and it is load-bearing rather than a
     * convenience — it is what makes the call a retirement *of this claim*. A launch that
     * arrived while another was latched is a different object, so this leaves it alone to be
     * claimed when the current dialog closes; an already-retired channel holds `null`, so
     * nothing is re-requested. `retire` then makes the call at-most-once per claim, and
     * `onRetire` confirms the same identity again at the owner.
     */
    useEffect(() => {
        if (intent !== null && intent === claimed) retire(intent);
    }, [claimed, intent, retire]);

    const open = useCallback(() => setIsOpen(true), []);

    const close = useCallback(() => {
        // Retiring the LATCHED claim — not the channel's current one — is what makes the
        // handoff one-shot: a return to this Bank afterwards finds nothing to re-open, and a
        // dialog a newer launch has already superseded cannot clear that newer launch. A
        // dialog opened with no claim at all retires nothing. Idempotent by construction: a
        // claim the effect already retired is a no-op here.
        if (claimed !== null) retire(claimed);
        retiredClaimRef.current = null;
        setClaimed(null);
        setIsOpen(false);
    }, [claimed, retire]);

    const returnToLauncher = useCallback(() => {
        if (!claimed || !onReturnToTab) {
            close();
            return;
        }
        const { tab } = claimed.returnTo;
        close();
        onReturnToTab(tab);
    }, [claimed, onReturnToTab, close]);

    return {
        open,
        close,
        returnToLauncher,
        isOpen,
        initialTypes: claimed?.requestedTypes,
        returnLabel: claimed && onReturnToTab ? claimed.returnTo.label : undefined,
    };
}
