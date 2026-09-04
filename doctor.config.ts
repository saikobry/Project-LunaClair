export default {
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
