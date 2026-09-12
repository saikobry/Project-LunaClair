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
        // hold timers and detaches their window listeners.
        // Evidence: .react-doctor/false-positives.md
        files: ['src/app/screens/collection-workspace/useCollectionMaterialReorder.ts'],
        rules: ['react-doctor/effect-needs-cleanup'],
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
