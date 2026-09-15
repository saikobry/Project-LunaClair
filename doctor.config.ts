export default {
  // Suppressions scoped to a single local exception. Kept narrower than a
  // `rules` off-switch so the rule stays active everywhere else.
  ignore: {
    overrides: [
      {
        // The mobile hold-to-drag `setTimeout` lives inside the `pointerdown`
        // handler this effect merely DEFINES and attaches, so it cannot be
        // scheduled on mount or a re-run — the rule's own SUPPRESS (1)
        // predicate. The effect still returns a teardown that clears pending
        // hold timers (`cancelPendingHolds`) and detaches their window
        // listeners. Relocated here from `useCollectionMaterialReorder.ts`
        // when the reorder engine was decomposed (Sep 2026) and again into
        // `hooks/` when the screen folder was reorganized; the gesture code
        // moved verbatim, so the exception moved with it.
        // Evidence: .react-doctor/false-positives.md
        files: [
          'src/app/screens/collection-workspace/hooks/useHoldToDragArming.ts',
        ],
        rules: ['react-doctor/effect-needs-cleanup'],
      },
      {
        // Whole-card pointer affordance: the shell `<div>` carries `onClick`
        // with no `role` on purpose — `role="button"` around nested real
        // buttons is invalid ARIA and a worse violation. Keyboard/AT parity
        // lives in the title `<button>` plus the action menu's Open item, and
        // the handler's `closest` guard keeps inner controls independent.
        // Evidence: .react-doctor/false-positives.md
        files: ['src/features/materials/components/MaterialCard.tsx'],
        rules: ['react-doctor/no-static-element-interactions'],
      },
    ],
  },
  rules: {
    // Intentional suppressions — see root AGENTS.md (React Doctor score notes):
    // - async-await-in-loop: sequential processing mandated by Dexie transaction
    //   lifespan, PDF page OOM, and SQLite CAS idempotency contracts.
    // - no-adjust-state-on-prop-change: React-docs-recommended render-phase
    //   prev-state comparison for the writer's unsaved-switch interception.
    // - no-derived-state / no-derived-state-effect: the writer draft is
    //   user-editable state initialized/refreshed from the server document
    //   via guarded effects; it cannot be derived during render (edits must
    //   survive re-fetches). Both sibling detectors fire on the same code.
    "react-doctor/async-await-in-loop": "off",
    "react-doctor/no-adjust-state-on-prop-change": "off",
    "react-doctor/no-derived-state": "off",
    "react-doctor/no-derived-state-effect": "off",
  },
};
