# React Doctor — documented false positives

Occurrences confirmed as detector false positives. Each entry records the rule's
own documented suppression predicate, the evidence, the review condition, and
the scope of the suppression that hides it. A suppression is not a fix and not a
pass: it records why the diagnostic is not actionable, so the code is never
reshaped to satisfy a pattern matcher.

## `react-doctor/effect-needs-cleanup` — `src/app/screens/collection-workspace/hooks/useHoldToDragArming.ts`

> **Relocated (Sep 2026, twice).** The reorder engine was decomposed into
> `reorderListGeometry` (slot math + commit animation), `useDesktopRowDrag`,
> `useHoldToDragArming` (this gesture), and a thin `useCollectionMaterialReorder`
> orchestrator; the screen folder was then reorganized so support modules live in
> `hooks/`, `components/`, `modals/`, `styles/`, and `utils/` subfolders. The
> gesture code moved verbatim both times, so the exception moved with it — each
> previous path no longer contains the effect and its entry was removed from
> `doctor.config.ts`.

- **Rule predicate used:** `effect-needs-cleanup` → _Validation prompt_ → **SUPPRESS (1)**:
  "the timer/subscription is NOT scheduled synchronously by the effect's own
  mount/re-run body but sits inside a callback the effect merely DEFINES and
  hands off: … a click/keydown handler closure: so the timer only runs on a later
  user/event tick and the effect owns no live resource to clean."
- **Observed evidence:**
  - The reported `setTimeout` sits inside `onPointerDown`, the mobile
    hold-to-drag gesture handler. The effect only _defines and attaches_ that
    handler (`rowEl.addEventListener('pointerdown', onPointerDown)`), so the
    timer cannot be scheduled on mount or on a re-run — only on a later user
    pointerdown.
  - The reported effect **does** return a teardown that releases everything it
    owns: it removes each registered `pointerdown` listener
    (`rowEl.removeEventListener('pointerdown', handler)`) and calls
    `cancelPendingHolds()`, which `clearTimeout`s every pending hold timer and
    detaches that hold's `pointermove` / `pointerup` / `pointercancel` listeners.
  - The timer id therefore cannot be a top-level `const id = setTimeout(…)` that
    the teardown clears: one hold timer is created per interaction, not per
    effect run. Three teardown shapes were attempted (opaque per-hold closures, a
    direct `clearTimeout(hold.timer)` loop, and a local helper containing
    `clearTimeout`) and the detector fired on all of them.
- **Outcome:** Rejected — documented exception; no behavioural defect.
- **Suppression:** `doctor.config.ts` → `ignore.overrides` scoped to this one file
  and this one rule (not a repo-wide `rules` off-switch, so real timer and
  subscription leaks elsewhere are still reported). A file-wide exception is used
  because the detector anchors the diagnostic on the effect, and the gesture
  handler is defined inline inside it.
- **Review condition:** Re-check if this effect becomes able to schedule a timer
  synchronously on mount/re-run, or if `onPointerDown` stops being owned by this
  effect's lifecycle. The Sep 2026 decomposition relocated the gesture but still
  defines it inside the effect, so the exception stands; remove the
  `ignore.overrides` entry if the gesture is ever defined outside the effect.
- **Scan-scope caveat (Sep 2026):** `react-doctor --scope changed` did **not**
  report this diagnostic while the file was newly added — only `--scope full`
  surfaced it. Removing or retargeting an override must therefore be verified
  with a **full** scan; a changed-scope scan can silently pass.

## `react-doctor/no-static-element-interactions` — `src/features/materials/components/MaterialCard.tsx`

- **Rule predicate used:** `no-static-element-interactions` → "Give clickable
  static elements a `role`, or use a button or link."
- **Observed evidence:**
  - The card shell `<div>` carries `onClick` (whole-card pointer affordance)
    with deliberately no `role`: the shell nests real `<button>`/`<input>` controls
    (title, filing trigger, badges, popover rows, action menu), and wrapping
    them in `role="button"` is invalid ARIA — the fix the rule suggests would
    be the worse violation.
  - Keyboard/AT parity is complete without the shell interaction: the title
    `<button>` and the action menu's Open item both invoke `onOpen`, and every
    inner control keeps independent semantics and focus order (no `role`
    wrapper was removed to achieve this earlier).
  - The handler itself guards with `closest('button, a, input, textarea,
    select, [role="menu"], [role="dialog"]')` plus a `popoverRef.contains`
    check, so inner-control clicks can never double-fire into `onOpen`.
- **Outcome:** Rejected — documented intentional exception; no behavioural defect.
- **Suppression:** `doctor.config.ts` → `ignore.overrides` scoped to this one file
  and this one rule (not a repo-wide `rules` off-switch, so genuinely
  interaction-less static elements elsewhere are still reported).
- **Review condition:** Re-check if the shell gains `role`/`tabIndex` keyboard
  handling (then the exception is obsolete — remove it) or if the title button
  / menu Open item stop offering keyboard-equivalent opening (then the
  exception is invalid — restore a real affordance instead).
