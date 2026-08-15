# src/services/ — Legacy Infrastructure Services

## Purpose

Legacy infrastructure adapters: content fetch helpers for the API-backed repositories. Primary persistence has moved to `src/infrastructure/database/` (Dexie/IndexedDB). Services abstract side effects so features remain testable and decoupled. The localStorage storage layer was removed in the Aug 2026 cleanup sweep — persistence is Dexie-only.

## Ownership

- `content/ApiDocumentRepository.ts` — Class implementing `DocumentRepository` async contract: resolves `StudyMaterial` → `Document` via HTTP `fetch('/api/documents/{documentId}')`. Throws `DocumentNotFoundError` on non-200 or network failure. Delegates transformation to `markdownPreprocessor`. Singleton `apiDocumentRepository`.
- `content/ApiCatalogRepository.ts` — Class implementing `CatalogRepository` async contract: fetches the D1 catalog snapshot (`GET /api/catalog`, SW-cached) and resolves single materials authoritatively for import (`GET /api/catalog/materials/:id`, uncached). Singleton `apiCatalogRepository`.
- `content/ApiQuizContentRepository.ts` — Class implementing `QuizContentRepository` async contract: fetches the D1 quiz snapshot (`GET /api/quiz`, assembled shapes). Singleton `apiQuizContentRepository`.
- `content/HybridDocumentRepository.ts` — Class implementing `DocumentRepository` async contract: serves locally imported document content from Dexie (`DocumentContentRepository`) first, falling back to the API-backed repository. Imported materials read fully offline; unimported materials hit the API (SW-cached).
- `content/markdownPreprocessor.ts` — Pure utility: resolves relative image URLs (`images/…` → `/api/documents/{documentId}/figures/…`).
- `indexeddb/` — Deprecated placeholder (superseded by `src/infrastructure/database/`)

## Local Contracts

- Services import from `shared/` (types, constants) and `domain/` (interfaces) but never from features.
- `ApiDocumentRepository` resolves content via HTTP fetch from `/api/documents/{documentId}` (proxied in dev/prod), which is cached offline by the service worker via Workbox `CacheFirst`.
- `ApiCatalogRepository.getMaterial` hits the uncached per-material endpoint (Worker sends `Cache-Control: no-store`) so imports resolve against current server state, never the cached snapshot.
- `markdownPreprocessor` is a pure function — receives raw markdown + `documentId`, rewrites figure image URLs to `/api/documents/{documentId}/figures/...`, returns transformed markdown.
- Storage keys are namespaced under `lunaclair.{domain}.{entity}` (see `shared/constants/storageKeys.ts`).

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
