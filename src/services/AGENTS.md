# src/services/ — Infrastructure Services

## Purpose

Infrastructure adapters: localStorage wrappers, IndexedDB helpers, and future Firebase/Auth/API clients. Services abstract side effects so features remain testable and decoupled.

## Ownership

- `storage/localStorage.ts` — Generic `getFromStorage<T>()`, `saveToStorage<T>()`, `removeFromStorage()` with silent error handling
- `storage/LocalStorageLibraryRepository.ts` — Class implementing `LibraryRepository` async contract with `AbortSignal` support and legacy key migration. Module-level singleton `localStorageLibraryRepository`.
- `storage/LocalStorageAnnotationRepository.ts` — Class implementing `AnnotationRepository` async contract with `AbortSignal` support and legacy key migration. Module-level singleton `localStorageAnnotationRepository`.
- `storage/index.ts` — Barrel re-export of localStorage helpers + repository implementations
- `content/LocalDocumentRepository.ts` — Class implementing `DocumentRepository` async contract: resolves `StudyMaterial` → `Document` via in-memory content store with markdown figure preprocessing. Exports `registerContent()` for bootstrap and singleton `localDocumentRepository`.
- `content/index.ts` — Barrel re-export of `LocalDocumentRepository`, `localDocumentRepository`, `registerContent`
- `indexeddb/` — Reserved for future IndexedDB implementation
- `index.ts` — Barrel export of all service-layer modules

## Local Contracts

- Services import from `shared/` (types, constants) and `domain/` (interfaces) but never from features.
- All storage operations are silent on failure — errors are swallowed, not logged.
- `getFromStorage` accepts a fallback value returned when key is missing or parsing fails.
- Features call storage via repository contract interfaces, never `localStorage` directly.
- `LocalDocumentRepository` resolves content from an in-memory store populated at bootstrap via `registerContent()`.
- Repositories include automatic legacy key migration (tagged `TODO(v1.0)`) from pre-Phase 3 storage keys to namespaced `lunaclair.*` keys.
- Storage keys are namespaced under `lunaclair.{domain}.{entity}` (see `shared/constants/storageKeys.ts`).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
