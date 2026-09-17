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

## `react-doctor/no-static-element-interactions` — `src/app/screens/explore/components/ShareCard.tsx`

- **Rule predicate used:** same rule and same predicate as the `MaterialCard`
  entry above: "Give clickable static elements a `role`, or use a button or
  link."
- **Observed evidence:**
  - The share card shell `<div>` carries `onClick` for the whole-card pointer
    affordance, deliberately with no `role`. The shell nests the real `Clone to
    Library` `<button>` (and previously a second action button), so the
    suggested `role="button"` wrapper would nest buttons inside a button role —
    the worse violation, and the exact invalidity the Explore overhaul removed.
  - Keyboard/AT parity does not depend on the shell: the title inside the `h3`
    is a real `<button>` with the visible title as its accessible name, is the
    only open control, and wears the `:focus-visible` ring. The body click is a
    pointer convenience on top of a complete keyboard path.
  - The handler guards with `closest('button, a, input, textarea, select,
    [role="menu"], [role="dialog"]')`, the `MaterialCard` guard shape, so the
    nested `Clone` action can never double-fire into `onOpen` (pinned by an
    explore unit test).
- **Outcome:** Rejected — documented intentional exception; no behavioural defect.
  The alternative that would silence the rule (Astryx `ClickableCard`, whose
  sr-only interactive element owns the role) was considered and declined: it
  adds a primitive used nowhere else, ships its own hover overlay against the
  shared accent-border/lift idiom, and would leave the app's two cards with
  different opening semantics.
- **Suppression:** `doctor.config.ts` → `ignore.overrides` scoped to this one
  file and this one rule (a second scoped entry, still not a repo-wide `rules`
  off-switch).
- **Review condition:** Re-check if the shell gains `role`/`tabIndex` keyboard
  handling (exception obsolete — remove it) or if the title button stops being
  the full keyboard-equivalent open path (exception invalid — restore a real
  affordance).
- **Scan-scope caveat (confirmed again, Sep 2026):** with the Phase 3 semantics
  change in place, `--scope changed` still reported **100/100** while
  `--scope full` reported the warning on this exact line. A changed-scope scan
  therefore proves nothing about this diagnostic for a **modified** file either
  — not just for a newly added one. Full scan is the only valid check.

## `react-doctor/no-dynamic-import-path` — `docs/prototypes/_t.html`

- **Rule predicate used:** `no-dynamic-import-path` → non-static (runtime-
  computed) module import path, aimed at bundler-resolved `import()` / dynamic
  `src` in application code.
- **Observed evidence:**
  - `_t.html` is a **saved third-party design artifact** — a Claude artifact
    page ("saved from …claudeusercontent.com/_f/…") pasted into
    `docs/prototypes/` as a ShareCard byline-layout reference. It is not
    application code, is never imported or bundled, and contains no app
    imports at all.
  - The flagged line 3 is the artifact host's own `frame-runtime` bootstrap
    (`<script>window.__FRAME_PREAMBLE=…</script>` plus an inline loader that
    references remote `/_runtime/*.js` capability scripts). That script is
    part of the saved page's original environment, not something LunaClair
    ships or executes in the app.
- **Outcome:** Rejected — reference file outside the bundler's graph; the
  rule does not apply to it.
- **Suppression:** `doctor.config.ts` → `ignore.overrides` scoped to this one
  file and this one rule (the rule stays active for all application code).
- **Review condition:** Re-check if this file is ever promoted into the app
  build (then the exception must be removed and the markup canonicalized), or
  if it is deleted. If the prototype is superseded by
  `docs/prototypes/canonical-cards.html` and removed, delete this entry and
  the override with it.
