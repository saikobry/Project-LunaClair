# src/services/ — Infrastructure Services

## Purpose

Infrastructure adapters: localStorage wrappers, IndexedDB helpers, and future Firebase/Auth/API clients. Services abstract side effects so features remain testable and decoupled.

## Ownership

- `storage/localStorage.ts` — Generic `getFromStorage<T>()`, `saveToStorage<T>()`, `removeFromStorage()` with silent error handling
- `storage/LocalStorageLibraryRepository.ts` — Class implementing `LibraryRepository` async contract with `AbortSignal` support. Respects `input.sourceType`/`input.sourceId` on create. Module-level singleton `localStorageLibraryRepository`.
- `storage/LocalStorageAnnotationRepository.ts` — Class implementing `AnnotationRepository` async contract with `AbortSignal` support. Module-level singleton `localStorageAnnotationRepository`.
- `storage/index.ts` — Barrel re-export of localStorage helpers + repository implementations
- `content/LocalDocumentRepository.ts` — Class implementing `DocumentRepository` async contract: resolves `StudyMaterial` → `Document` via HTTP `fetch('/materials/{sourceId}/index.md')`. Throws `DocumentNotFoundError` on 404 or network failure. Delegates transformation to `markdownPreprocessor`. Singleton `localDocumentRepository`.
- `content/markdownPreprocessor.ts` — Pure utility: resolves relative image URLs (`images/…` → `/materials/{sourceId}/images/…`).
- `content/index.ts` — Barrel re-export of `LocalDocumentRepository`, `localDocumentRepository`, `preprocessMarkdown`
- `indexeddb/` — Reserved for future IndexedDB implementation
- `index.ts` — Barrel export of all service-layer modules

## Local Contracts

- Services import from `shared/` (types, constants) and `domain/` (interfaces) but never from features.
- All storage operations are silent on failure — errors are swallowed, not logged.
- `getFromStorage` accepts a fallback value returned when key is missing or parsing fails.
- Features call storage via repository contract interfaces, never `localStorage` directly.
- `LocalDocumentRepository` resolves content via HTTP fetch from `public/materials/{sourceId}/index.md` (static assets, not bundled JS).
- `markdownPreprocessor` is a pure function — no side effects, no I/O. Receives raw markdown + `sourceId`, returns transformed markdown.
- Storage keys are namespaced under `lunaclair.{domain}.{entity}` (see `shared/constants/storageKeys.ts`).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
