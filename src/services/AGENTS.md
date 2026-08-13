# src/services/ — Legacy Infrastructure Services

## Purpose

Legacy infrastructure adapters: localStorage wrappers and content fetch helpers. Primary persistence has moved to `src/infrastructure/database/` (Dexie/IndexedDB). Services abstract side effects so features remain testable and decoupled.

## Ownership

- `storage/localStorage.ts` — Generic `getFromStorage<T>()`, `saveToStorage<T>()`, `removeFromStorage()` with silent error handling
- `storage/LocalStorageLibraryRepository.ts` — Class implementing `LibraryRepository` async contract with `AbortSignal` support. Respects `input.sourceType`/`input.sourceId` on create. Module-level singleton `localStorageLibraryRepository`.
- `storage/LocalStorageAnnotationRepository.ts` — Class implementing `AnnotationRepository` async contract with `AbortSignal` support. Module-level singleton `localStorageAnnotationRepository`.
- `storage/index.ts` — Barrel re-export of localStorage helpers + repository implementations
- `content/ApiDocumentRepository.ts` — Class implementing `DocumentRepository` async contract: resolves `StudyMaterial` → `Document` via HTTP `fetch('/api/documents/{sourceId}')`. Throws `DocumentNotFoundError` on non-200 or network failure. Delegates transformation to `markdownPreprocessor`. Singleton `apiDocumentRepository`.
- `content/markdownPreprocessor.ts` — Pure utility: resolves relative image URLs (`images/…` → `/api/documents/{sourceId}/figures/…`).
- `content/index.ts` — Barrel re-export of `ApiDocumentRepository`, `apiDocumentRepository`, `preprocessMarkdown`
- `indexeddb/` — Deprecated placeholder (superseded by `src/infrastructure/database/`)
- `index.ts` — Barrel export of all service-layer modules

## Local Contracts

- Services import from `shared/` (types, constants) and `domain/` (interfaces) but never from features.
- All storage operations are silent on failure — errors are swallowed, not logged.
- `getFromStorage` accepts a fallback value returned when key is missing or parsing fails.
- Features call storage via repository contract interfaces, never `localStorage` directly.
- `ApiDocumentRepository` resolves content via HTTP fetch from `/api/documents/{sourceId}` (proxied in dev/prod), which is cached offline by the service worker via Workbox `CacheFirst`.
- `markdownPreprocessor` is a pure function — receives raw markdown + `sourceId`, rewrites figure image URLs to `/api/documents/{sourceId}/figures/...`, returns transformed markdown.
- Storage keys are namespaced under `lunaclair.{domain}.{entity}` (see `shared/constants/storageKeys.ts`).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
