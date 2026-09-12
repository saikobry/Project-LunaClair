# React Doctor — documented false positives

Occurrences confirmed as detector false positives. Each entry records the rule's
own documented suppression predicate, the evidence, the review condition, and
the scope of the suppression that hides it. A suppression is not a fix and not a
pass: it records why the diagnostic is not actionable, so the code is never
reshaped to satisfy a pattern matcher.

## `react-doctor/effect-needs-cleanup` — `src/app/screens/collection-workspace/useCollectionMaterialReorder.ts`

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
  effect's lifecycle. Remove the `ignore.overrides` entry together with the code
  change whenever this file is restructured to define the gesture outside the
  effect.
