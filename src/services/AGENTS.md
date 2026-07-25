# src/services/ — Infrastructure Services

## Purpose

Infrastructure adapters: localStorage wrappers, IndexedDB helpers, and future Firebase/Auth/API clients. Services abstract side effects so features remain testable and decoupled.

## Ownership

- `storage/localStorage.ts` — Generic `getFromStorage<T>()`, `saveToStorage<T>()`, `removeFromStorage()` with silent error handling
- `storage/index.ts` — Barrel re-export of localStorage helpers
- `indexeddb/` — Reserved for future IndexedDB implementation
- `index.ts` — Barrel export: `getFromStorage`, `saveToStorage`, `removeFromStorage`

## Local Contracts

- Services import from `shared/` (types) but never from features.
- All storage operations are silent on failure — errors are swallowed, not logged.
- `getFromStorage` accepts a fallback value returned when key is missing or parsing fails.
- Features call storage helpers, never `localStorage` directly.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
